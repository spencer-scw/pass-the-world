#nullable enable
using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Xna.Framework;
using PassTheWorld.Common.Api;
using PassTheWorld.UI;
using Terraria;
using Terraria.ID;
using Terraria.IO;

namespace PassTheWorld.Common;

/// <summary>
/// The turn lifecycle on the client: link account → claim → download → play → (checkpoints) → save &amp; quit → upload.
/// Network and file work runs on background tasks; anything touching game state hops back to the main thread.
/// </summary>
public static class TurnFlow
{
    private static volatile Func<string> _status = () => "";
    private static int _version;
    private static int _busy;
    private static int _checkpointRunning;

    /// <summary>Message shown at the bottom of the Pass the World menu. The menu reads it every frame.</summary>
    public static string Status
    {
        get => _status();
        private set
        {
            var text = value;
            _status = () => text;
            Interlocked.Increment(ref _version);
        }
    }

    /// <summary>A status that's re-evaluated every frame, for messages with a countdown in them.</summary>
    private static void SetLiveStatus(Func<string> status)
    {
        _status = status;
        Interlocked.Increment(ref _version);
    }

    /// <summary>Bumped whenever something the menu shows changes, so it knows to refresh.</summary>
    public static int Version => Volatile.Read(ref _version);

    public static bool Busy => Volatile.Read(ref _busy) == 1;

    private static int _gamesVersion;

    /// <summary>Bumped whenever the server's view of our games has likely changed, so the menu re-fetches.</summary>
    public static int GamesVersion => Volatile.Read(ref _gamesVersion);

    private static void GamesChanged() => Interlocked.Increment(ref _gamesVersion);

    /// <summary>True while the player is inside the world for the turn they hold.</summary>
    public static volatile bool InTurnWorld;

    /// <summary>A final upload failed; the menu offers a retry while the grace period lasts.</summary>
    public static volatile bool PendingFinal;

    /// <summary>The final bundle, kept so "Retry upload" sends exactly what was saved at the end of the turn.</summary>
    private static byte[]? _finalBundle;

    private static void Log(Exception e) => PassTheWorld.Instance.Logger.Error("[PassTheWorld]", e);

    private static void Chat(string message, Color color) => Main.QueueMainThreadAction(() => Main.NewText(message, color));

    /// <summary>Runs one user-initiated operation at a time and turns exceptions into a status message.</summary>
    private static void RunExclusive(string failurePrefix, Func<Task> work)
    {
        if (Interlocked.CompareExchange(ref _busy, 1, 0) != 0) return;
        Interlocked.Increment(ref _version);
        Task.Run(async () =>
        {
            try
            {
                await work();
            }
            catch (Exception e)
            {
                Log(e);
                Status = Messages.Status.Failed(failurePrefix, e.Message);
            }
            finally
            {
                Volatile.Write(ref _busy, 0);
                Interlocked.Increment(ref _version);
            }
        });
    }

    // ------------------------------------------------------------------ account

    public static void LinkAccount() => RunExclusive(Messages.Status.LinkingFailed, async () =>
    {
        var start = await PtwApi.StartDeviceLink();
        Status = Messages.Status.EnterLinkCode(start.UserCode);
        Utils.OpenToURL(start.VerifyUrl);

        var expires = DateTime.UtcNow.AddSeconds(start.ExpiresIn);
        while (DateTime.UtcNow < expires)
        {
            await Task.Delay(TimeSpan.FromSeconds(start.IntervalSeconds));
            var poll = await PtwApi.PollDeviceLink(start.DeviceCode);
            if (poll is { Status: "approved", Token: not null })
            {
                TokenStore.Save(poll.Token, poll.User?.DisplayName);
                Status = Messages.Status.Linked(poll.User?.DisplayName);
                GamesChanged();
                return;
            }
        }
        Status = Messages.Status.LinkCodeExpired;
    });

    public static void Unlink()
    {
        TokenStore.Clear();
        Status = Messages.Status.Unlinked;
        GamesChanged();
    }

    // ------------------------------------------------------------------ setup

    /// <summary>
    /// Admin: upload the freshly created character + world as the game's starting point, then move them out of the
    /// normal folders into the game's stored save. Call on the main thread.
    /// </summary>
    public static void UploadInitialSave(ModGameDto game)
    {
        Main.LoadPlayers();
        Main.LoadWorlds();
        var player = Main.PlayerList.FirstOrDefault(p => !p.IsCloudSave && p.Name == game.PlayerName);
        var world = Main.WorldList.FirstOrDefault(w => !w.IsCloudSave && w.Name == game.WorldName);
        if (player == null || world == null)
        {
            Status = Messages.Status.StartingSaveNotFound(game.PlayerName, game.WorldName);
            return;
        }
        string playerPath = player.Path, worldPath = world.Path;

        RunExclusive(Messages.Status.UploadFailed, async () =>
        {
            Status = Messages.Status.UploadingStartingSave;
            var zip = SaveBundle.Create(
                worldPath,
                playerPath,
                Path.GetFileNameWithoutExtension(worldPath),
                Path.GetFileNameWithoutExtension(playerPath),
                game.Id,
                turnSeq: 0);
            await PtwApi.UploadInitialSave(game.Id, zip);
            try
            {
                SaveStore.AdoptFromVanillaFolders(game.Id, worldPath, playerPath);
                Status = Messages.Status.StartingSaveUploaded(zip.Length);
            }
            catch (Exception e)
            {
                Log(e);
                Status = Messages.Status.StartingSaveNotMoved(zip.Length, e.Message);
            }
            GamesChanged();
            Main.QueueMainThreadAction(() =>
            {
                Main.LoadPlayers();
                Main.LoadWorlds();
            });
        });
    }

    // ------------------------------------------------------------------ start / resume

    public static void StartOrResume(ModGameDto game) => RunExclusive(Messages.Status.StartFailed, async () =>
    {
        var turn = game.CurrentTurn ?? throw new InvalidOperationException(Messages.Errors.NoTurnAvailable);
        Status = Messages.Status.Claiming;
        var claim = await PtwApi.Claim(turn.Id);
        GamesChanged();

        // We were playing this turn on this machine: the stored save is at least as new as the last checkpoint.
        var local = LocalTurnState.Load();
        var stored = claim.Resumed && local?.TurnId == claim.Turn.Id ? SaveStore.Find(claim.GameId) : null;
        if (stored != null)
        {
            Status = Messages.Status.ResumingLocal;
        }
        else
        {
            Status = Messages.Status.Downloading(claim.Snapshot.Size);
            var zip = await PtwApi.DownloadSnapshot(claim.GameId, claim.Snapshot.Id);
            if (SaveBundle.Sha256Hex(zip) != claim.Snapshot.Sha256)
                throw new InvalidDataException(Messages.Errors.IntegrityCheckFailed);
            stored = SaveStore.ImportBundle(claim.GameId, zip);
        }

        // Copy into the normal folders for the length of the turn, so the game and other mods find the files
        // where they expect them.
        var staged = SaveStore.Stage(stored);
        TurnSession.Begin(claim, staged);
        new LocalTurnState(claim.GameId, claim.Turn.Id).Save();
        Status = Messages.Status.LoadingWorld;
        Main.QueueMainThreadAction(() => EnterWorld(staged.WorldPath, staged.PlayerPath));
    });

    private static bool SamePath(string a, string b) => Path.GetFullPath(a) == Path.GetFullPath(b);

    /// <summary>Main thread: select the character and world and load straight in, skipping the select screens.</summary>
    private static void EnterWorld(string worldPath, string playerPath)
    {
        Main.LoadPlayers();
        Main.LoadWorlds();
        PlayerFileData? player = Main.PlayerList.FirstOrDefault(p => !p.IsCloudSave && SamePath(p.Path, playerPath));
        WorldFileData? world = Main.WorldList.FirstOrDefault(w => !w.IsCloudSave && SamePath(w.Path, worldPath));
        if (player == null || world == null)
        {
            Status = Messages.Status.DownloadedFilesMissing;
            SaveStore.RecoverStaged();
            TurnSession.Clear();
            return;
        }

        Main.menuMultiplayer = false;
        Main.netMode = NetmodeID.SinglePlayer;
        player.SetAsActive();
        world.SetAsActive();
        Main.menuMode = 10; // "loading" screen
        WorldGen.playWorld();
    }

    // ------------------------------------------------------------------ while playing

    public static void SendHeartbeat()
    {
        var turnId = TurnSession.TurnId;
        if (turnId == null) return;
        Task.Run(async () =>
        {
            try
            {
                var hb = await PtwApi.Heartbeat(turnId);
                TurnSession.UpdateClock(hb.DeadlineAt, hb.ServerNow);
            }
            catch (PtwApiException e) when (e.Status is 403 or 409)
            {
                // An admin skipped or expired the turn. Leave without uploading anything. (Chat is cleared when we
                // leave the world, so the explanation goes in the menu's status line.)
                Main.QueueMainThreadAction(() => Abandon(e.Message));
            }
            catch (Exception e)
            {
                Log(e); // offline blips are fine; the deadline is enforced locally too
            }
        });
    }

    /// <summary>Main thread: save in place and upload a checkpoint without leaving the world.</summary>
    public static void CheckpointWhilePlaying()
    {
        if (!TurnSession.Active || Interlocked.CompareExchange(ref _checkpointRunning, 1, 0) != 0) return;
        var playerFile = Main.ActivePlayerFileData;
        string turnId = TurnSession.TurnId!;
        var staged = TurnSession.Staged!;
        int seq = TurnSession.TurnSeq;

        Task.Run(async () =>
        {
            try
            {
                // Same calls vanilla autosave makes from a worker thread. Holding the save lock keeps autosave (or
                // anything else that saves) from writing these files while we write or read them; see SaveLock.
                byte[] zip;
                lock (SaveLock.Gate)
                {
                    Player.SavePlayer(playerFile, skipMapSave: false);
                    WorldFile.SaveWorld(useCloudSaving: false, resetTime: false);
                    zip = BundleStaged(staged, seq);
                }
                await PtwApi.UploadCheckpoint(turnId, zip);
                Chat(Messages.Chat.CheckpointSaved, Color.Gray);
            }
            catch (Exception e)
            {
                Log(e);
                Chat(Messages.Chat.CheckpointFailed(e.Message), Color.Orange);
            }
            finally
            {
                Volatile.Write(ref _checkpointRunning, 0);
            }
        });
    }

    // ------------------------------------------------------------------ ending

    /// <summary>Main thread: time is up. Save, quit to the menu, then upload (see <see cref="OnSavedAndQuit"/>).</summary>
    public static void EndTurnNow(string message)
    {
        if (TurnSession.Ending) return;
        TurnSession.Ending = true;
        Main.NewText(message, Color.Gold);
        WorldGen.SaveAndQuit(null);
    }

    /// <summary>
    /// Called (via a hook on WorldGen.SaveAndQuit) after the world and player have been written to disk,
    /// whether the turn ended or the player quit early.
    /// </summary>
    public static void OnSavedAndQuit()
    {
        if (!TurnSession.Active || !InTurnWorld) return;
        InTurnWorld = false;

        var staged = TurnSession.Staged!;
        string turnId = TurnSession.TurnId!;
        int seq = TurnSession.TurnSeq;
        bool ending = TurnSession.Ending;

        // Bundle the files the game just wrote before moving anything, so the upload is always the newest data.
        // Then move the save back into storage and out of the normal folders.
        byte[] zip;
        try
        {
            zip = BundleStaged(staged, seq);
        }
        finally
        {
            try
            {
                SaveStore.Unstage(staged);
            }
            catch (Exception e)
            {
                Log(e); // the staged copy is recovered the next time the mod loads
            }
        }

        if (ending)
        {
            Status = Messages.Status.UploadingFinal;
            _finalBundle = zip;
            Task.Run(SubmitFinal);
        }
        else
        {
            // Quit mid-turn: checkpoint so a crash or PC switch doesn't lose progress. The clock keeps running.
            SetLiveStatus(() => Messages.Status.LeftMidTurn(TurnSession.Remaining));
            Task.Run(async () =>
            {
                try
                {
                    await PtwApi.UploadCheckpoint(turnId, zip);
                    SetLiveStatus(() => Messages.Status.MidTurnCheckpointSaved(TurnSession.Remaining));
                    GamesChanged();
                }
                catch (Exception e)
                {
                    Log(e);
                    Status = Messages.Status.CheckpointFailed(e.Message);
                }
            });
        }
        Main.QueueMainThreadAction(ReturnToMenu);
    }

    public static void RetryFinal() => RunExclusive(Messages.Status.UploadFailed, SubmitFinal);

    /// <summary>A bundle of the files being played, named by their canonical (stored) names.</summary>
    private static byte[] BundleStaged(StagedSave staged, int seq) =>
        SaveBundle.Create(staged.WorldPath, staged.PlayerPath, staged.Source.WorldFile, staged.Source.PlayerFile, staged.Source.GameId, seq);

    private static async Task SubmitFinal()
    {
        string turnId = TurnSession.TurnId!;
        var stored = TurnSession.Staged!.Source;
        var zip = _finalBundle
            ?? SaveBundle.Create(stored.WorldPath, stored.PlayerPath, stored.WorldFile, stored.PlayerFile, stored.GameId, TurnSession.TurnSeq);
        PendingFinal = false;

        const int maxAttempts = 5;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                await PtwApi.FinishTurn(turnId, zip);
                Status = Messages.Status.TurnSubmitted;
                EndSession();
                return;
            }
            catch (PtwApiException e) when (e.Status is 403 or 409)
            {
                Status = Messages.Status.FinalRejected(e.Message);
                EndSession();
                return;
            }
            catch (Exception e)
            {
                Log(e);
                Status = Messages.Status.FinalRetrying(e.Message, attempt, maxAttempts);
                await Task.Delay(TimeSpan.FromSeconds(5 * attempt));
            }
        }
        PendingFinal = true;
        Status = Messages.Status.FinalGaveUp;
        GamesChanged();
    }

    private static void EndSession()
    {
        _finalBundle = null;
        LocalTurnState.Clear();
        TurnSession.Clear();
        GamesChanged();
    }

    /// <summary>Main thread: the server ended our turn. Leave without saving so nothing diverges.</summary>
    private static void Abandon(string reason)
    {
        InTurnWorld = false;
        if (!Main.gameMenu) WorldGen.JustQuit();
        // That turn's progress is void: drop the staged copy rather than copying it back into storage.
        SaveStore.DiscardStaged();
        EndSession();
        Status = Messages.Status.TurnEndedByServer(reason);
        ReturnToMenu();
    }

    /// <summary>
    /// Main thread: after staged files are removed, reload the game's player/world lists (they still point at the
    /// deleted files, and vanilla crashes drawing a list entry whose file is gone), then show our menu rather than
    /// wherever vanilla left us (JustQuit lands on world select).
    /// </summary>
    private static void ReturnToMenu()
    {
        Main.LoadPlayers();
        Main.LoadWorlds();
        PtwMenuState.Open();
    }
}
