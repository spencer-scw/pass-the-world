#nullable enable
using System;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using PassTheWorld.Common;
using Terraria;
using Terraria.GameContent;
using Terraria.ModLoader;
using Terraria.ModLoader.IO;

namespace PassTheWorld.Systems;

/// <summary>
/// In-world side of a turn: tags the world with its game, runs the countdown, heartbeats, checkpoints and the HUD timer.
/// </summary>
public class TurnSystem : ModSystem
{
    /// <summary>The Pass the World game this world belongs to (stored in the world's .twld), or null.</summary>
    public string? WorldGameId;
    public int WorldTurnSeq;

    internal bool KickPending;

    private DateTime _nextHeartbeat;
    private DateTime _nextCheckpoint;
    private bool _warned10, _warned5, _warned1;

    public override void ClearWorld()
    {
        WorldGameId = null;
        WorldTurnSeq = 0;
        KickPending = false;
    }

    public override void SaveWorldData(TagCompound tag)
    {
        if (WorldGameId == null) return;
        tag["gameId"] = WorldGameId;
        tag["turnSeq"] = WorldTurnSeq;
    }

    public override void LoadWorldData(TagCompound tag)
    {
        WorldGameId = tag.ContainsKey("gameId") ? tag.GetString("gameId") : null;
        WorldTurnSeq = tag.GetInt("turnSeq");
    }

    /// <summary>Called by <see cref="Players.GatePlayer"/> once we're confirmed to be in the turn's world.</summary>
    internal void OnTurnWorldEntered()
    {
        WorldGameId = TurnSession.GameId;
        WorldTurnSeq = TurnSession.TurnSeq;
        TurnFlow.InTurnWorld = true;

        var now = DateTime.UtcNow;
        _nextHeartbeat = now;
        _nextCheckpoint = now.AddMinutes(PtwConfig.Instance.CheckpointMinutes);
        var remaining = TurnSession.Remaining;
        _warned10 = remaining <= TimeSpan.FromMinutes(10);
        _warned5 = remaining <= TimeSpan.FromMinutes(5);
        _warned1 = remaining <= TimeSpan.FromMinutes(1);
        Main.NewText(
            TurnSession.Resumed
                ? Messages.Chat.TurnResumed(TurnSession.TurnSeq, remaining, TurnSession.TurnLength)
                : Messages.Chat.TurnStarted(TurnSession.TurnSeq, TurnSession.TurnLength),
            Color.LightGreen);
    }

    public override void PostUpdateEverything()
    {
        if (Main.gameMenu) return;

        if (KickPending)
        {
            KickPending = false;
            WorldGen.JustQuit(); // leave without saving
            return;
        }

        if (!TurnFlow.InTurnWorld || TurnSession.Ending) return;

        var remaining = TurnSession.Remaining;
        Warn(ref _warned10, remaining, 10);
        Warn(ref _warned5, remaining, 5);
        Warn(ref _warned1, remaining, 1);

        if (remaining <= TimeSpan.Zero)
        {
            TurnFlow.EndTurnNow(Messages.Chat.TimeUp);
            return;
        }

        var now = DateTime.UtcNow;
        if (now >= _nextHeartbeat)
        {
            _nextHeartbeat = now.AddSeconds(60);
            TurnFlow.SendHeartbeat();
        }
        // Skip a checkpoint that would land right before the end; the final upload covers it.
        if (now >= _nextCheckpoint && remaining > TimeSpan.FromMinutes(2))
        {
            _nextCheckpoint = now.AddMinutes(PtwConfig.Instance.CheckpointMinutes);
            TurnFlow.CheckpointWhilePlaying();
        }
    }

    private static void Warn(ref bool warned, TimeSpan remaining, int minutes)
    {
        if (warned || remaining > TimeSpan.FromMinutes(minutes)) return;
        warned = true;
        Main.NewText(Messages.Chat.MinutesLeft(minutes), Color.Gold);
    }

    public override void PostDrawInterface(SpriteBatch spriteBatch)
    {
        if (!TurnFlow.InTurnWorld || Main.gameMenu) return;
        var remaining = TurnSession.Remaining;
        var color = remaining <= TimeSpan.FromMinutes(5) ? Color.OrangeRed : Color.White;
        var text = TurnSession.Ending ? Messages.Hud.Passing : Messages.Hud.TurnEndsIn(remaining);
        var size = FontAssets.MouseText.Value.MeasureString(text);
        Utils.DrawBorderString(spriteBatch, text, new Vector2((Main.screenWidth - size.X) / 2f, 8f), color);
    }
}
