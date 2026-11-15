using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Terraria;

namespace PassTheWorld.Common;

/// <summary>
/// A game's character and world, kept in our own folder so they never show up in the vanilla select screens:
///
///   tModLoader/PassTheWorld/Saves/&lt;gameId&gt;/
///     save.json                       which world and character this is
///     Worlds/&lt;world&gt;.wld, .twld
///     Players/&lt;player&gt;.plr, .tplr, &lt;player&gt;/ (map files)
///
/// File names here are the "canonical" ones that travel inside save bundles.
/// </summary>
public sealed record StoredSave(string GameId, string WorldFile, string PlayerFile)
{
    public string Root => SaveStore.GameRoot(GameId);
    public string WorldPath => Path.Combine(Root, "Worlds", WorldFile + ".wld");
    public string PlayerPath => Path.Combine(Root, "Players", PlayerFile + ".plr");
    public bool Exists => File.Exists(WorldPath) && File.Exists(PlayerPath);
}

/// <summary>
/// A stored save copied into the normal Worlds/Players folders for the length of a turn, so vanilla code and other
/// mods that assume those folders work normally. Staged files get a unique prefix so they can never overwrite one of
/// the player's own saves, even one with the same name.
/// </summary>
public sealed record StagedSave(StoredSave Source, string WorldFile, string PlayerFile)
{
    public string WorldPath => Path.Combine(SaveStore.WorldsFolder(), WorldFile + ".wld");
    public string PlayerPath => Path.Combine(SaveStore.PlayersFolder(), PlayerFile + ".plr");
}

public static class SaveStore
{
    private const string SaveInfoFile = "save.json";
    private const string StagingFile = "staging.json";

    private static readonly object Lock = new();

    // The game's normal save folders. Swappable so the file logic can be tested outside the game.
    internal static Func<string> WorldsFolder = () => Main.WorldPath;
    internal static Func<string> PlayersFolder = () => Main.PlayerPath;
    internal static Action<string> LogInfo = message => PassTheWorld.Instance.Logger.Info(message);

    public static string GameRoot(string gameId) => Path.Combine(LocalFiles.Root, "Saves", gameId);

    /// <summary>The stored save for a game, if this machine has one.</summary>
    public static StoredSave? Find(string gameId)
    {
        var info = LocalFiles.Read<StoredSave>(Path.Combine("Saves", gameId, SaveInfoFile));
        return info is { Exists: true } ? info : null;
    }

    /// <summary>Replaces the game's stored save with the contents of a downloaded bundle.</summary>
    public static StoredSave ImportBundle(string gameId, byte[] zip)
    {
        lock (Lock)
        {
            var root = GameRoot(gameId);
            var incoming = root + ".incoming";
            DeleteDirectory(incoming);
            var manifest = SaveBundle.Extract(zip, incoming);
            var save = new StoredSave(gameId, manifest.WorldFile, manifest.PlayerFile);
            ReplaceDirectory(incoming, root);
            LocalFiles.Write(Path.Combine("Saves", gameId, SaveInfoFile), save);
            return save;
        }
    }

    /// <summary>
    /// After the starting save is uploaded: moves the admin's freshly created character and world out of the
    /// normal folders into the game's stored save, replacing any previous starting save.
    /// </summary>
    public static StoredSave AdoptFromVanillaFolders(string gameId, string worldPath, string playerPath)
    {
        lock (Lock)
        {
            var save = new StoredSave(gameId, Path.GetFileNameWithoutExtension(worldPath), Path.GetFileNameWithoutExtension(playerPath));
            var incoming = GameRoot(gameId) + ".incoming";
            DeleteDirectory(incoming);
            CopySaveFiles(
                worldPath,
                playerPath,
                Path.Combine(incoming, "Worlds", save.WorldFile + ".wld"),
                Path.Combine(incoming, "Players", save.PlayerFile + ".plr"));
            ReplaceDirectory(incoming, save.Root);
            LocalFiles.Write(Path.Combine("Saves", gameId, SaveInfoFile), save);
            // Only delete the originals once the stored copy is safely in place.
            DeleteSaveFiles(worldPath, playerPath);
            return save;
        }
    }

    /// <summary>Copies a stored save into the normal folders under unique names, ready to play.</summary>
    public static StagedSave Stage(StoredSave save)
    {
        lock (Lock)
        {
            RecoverStagedUnsafe(); // never leave two staged copies around
            var prefix = $"PTW_{save.GameId[..Math.Min(8, save.GameId.Length)]}_";
            var staged = new StagedSave(save, prefix + save.WorldFile, prefix + save.PlayerFile);
            // Record first, so a crash part-way through still gets cleaned up.
            LocalFiles.Write(StagingFile, staged);
            CopySaveFiles(save.WorldPath, save.PlayerPath, staged.WorldPath, staged.PlayerPath);
            return staged;
        }
    }

    /// <summary>
    /// Copies the (now newer) staged files back into the stored save, then removes every trace of them from the
    /// normal folders, including the .bak files and daily backups the game made while they were there.
    /// </summary>
    public static StoredSave Unstage(StagedSave staged)
    {
        lock (Lock)
        {
            if (File.Exists(staged.WorldPath) && File.Exists(staged.PlayerPath))
                CopySaveFiles(staged.WorldPath, staged.PlayerPath, staged.Source.WorldPath, staged.Source.PlayerPath);
            RemoveStagedFiles(staged);
            return staged.Source;
        }
    }

    /// <summary>Removes staged files without copying them back (the server ended the turn; that progress is void).</summary>
    public static void DiscardStaged()
    {
        lock (Lock)
        {
            if (LocalFiles.Read<StagedSave>(StagingFile) is { } staged) RemoveStagedFiles(staged);
        }
    }

    /// <summary>
    /// If a previous session crashed or quit mid-turn, moves its staged files back into storage.
    /// Only call while no turn world is loaded.
    /// </summary>
    public static void RecoverStaged()
    {
        lock (Lock) RecoverStagedUnsafe();
    }

    private static void RecoverStagedUnsafe()
    {
        if (LocalFiles.Read<StagedSave>(StagingFile) is not { } staged) return;
        try
        {
            if (File.Exists(staged.WorldPath) && File.Exists(staged.PlayerPath))
                CopySaveFiles(staged.WorldPath, staged.PlayerPath, staged.Source.WorldPath, staged.Source.PlayerPath);
            LogInfo($"[PassTheWorld] Recovered staged save for game {staged.Source.GameId}");
        }
        finally
        {
            RemoveStagedFiles(staged);
        }
    }

    // ------------------------------------------------------------------ file helpers

    /// <summary>Copies .wld/.twld, .plr/.tplr and the character's map folder, renaming to the target file names.</summary>
    private static void CopySaveFiles(string fromWorld, string fromPlayer, string toWorld, string toPlayer)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(toWorld)!);
        Directory.CreateDirectory(Path.GetDirectoryName(toPlayer)!);

        File.Copy(fromWorld, toWorld, overwrite: true);
        CopyIfExists(Path.ChangeExtension(fromWorld, ".twld"), Path.ChangeExtension(toWorld, ".twld"));
        File.Copy(fromPlayer, toPlayer, overwrite: true);
        CopyIfExists(Path.ChangeExtension(fromPlayer, ".tplr"), Path.ChangeExtension(toPlayer, ".tplr"));

        var fromMaps = MapFolder(fromPlayer);
        var toMaps = MapFolder(toPlayer);
        DeleteDirectory(toMaps);
        if (Directory.Exists(fromMaps))
        {
            foreach (var file in Directory.EnumerateFiles(fromMaps, "*", SearchOption.AllDirectories))
            {
                if (file.EndsWith(".bak", StringComparison.OrdinalIgnoreCase)) continue;
                var dest = Path.Combine(toMaps, Path.GetRelativePath(fromMaps, file));
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                File.Copy(file, dest, overwrite: true);
            }
        }
    }

    /// <summary>Deletes a character and world from wherever they are, including .bak files and the map folder.</summary>
    private static void DeleteSaveFiles(string worldPath, string playerPath)
    {
        DeleteMatching(Path.GetDirectoryName(worldPath)!, Path.GetFileNameWithoutExtension(worldPath));
        DeleteMatching(Path.GetDirectoryName(playerPath)!, Path.GetFileNameWithoutExtension(playerPath));
        DeleteDirectory(MapFolder(playerPath));
    }

    private static void RemoveStagedFiles(StagedSave staged)
    {
        DeleteSaveFiles(staged.WorldPath, staged.PlayerPath);
        // tModLoader's daily backups: Backups/<yyyy-MM-dd>-<file>.zip
        DeleteBackups(Path.Combine(WorldsFolder(), "Backups"), staged.WorldFile);
        DeleteBackups(Path.Combine(PlayersFolder(), "Backups"), staged.PlayerFile);
        LocalFiles.Delete(StagingFile);
    }

    /// <summary>
    /// Deletes one save's files in a folder: .wld/.twld/.plr/.tplr plus their .bak/.bak2/... backups. Matches the
    /// exact base name, so "Hero" never touches "Hero.v2.plr" or "Heroine.plr".
    /// </summary>
    private static void DeleteMatching(string folder, string baseName)
    {
        if (!Directory.Exists(folder)) return;
        var pattern = new Regex("^" + Regex.Escape(baseName) + @"\.(wld|twld|plr|tplr)(\.bak\d*)?$");
        foreach (var file in Directory.EnumerateFiles(folder))
            if (pattern.IsMatch(Path.GetFileName(file)))
                File.Delete(file);
    }

    private static void DeleteBackups(string folder, string baseName)
    {
        if (!Directory.Exists(folder)) return;
        foreach (var file in Directory.EnumerateFiles(folder, "*-" + baseName + ".zip").Where(f => Path.GetFileName(f).StartsWith("20")))
            File.Delete(file);
    }

    private static string MapFolder(string playerPath) =>
        Path.Combine(Path.GetDirectoryName(playerPath)!, Path.GetFileNameWithoutExtension(playerPath));

    private static void CopyIfExists(string from, string to)
    {
        if (File.Exists(from)) File.Copy(from, to, overwrite: true);
        else if (File.Exists(to)) File.Delete(to);
    }

    private static void DeleteDirectory(string path)
    {
        if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
    }

    /// <summary>Swaps a freshly built folder into place, so a failure part-way through never leaves a half-written save.</summary>
    private static void ReplaceDirectory(string source, string target)
    {
        var old = target + ".old";
        DeleteDirectory(old);
        if (Directory.Exists(target)) Directory.Move(target, old);
        Directory.Move(source, target);
        DeleteDirectory(old);
    }
}
