using Microsoft.Xna.Framework;
using PassTheWorld.Common;
using PassTheWorld.Systems;
using Terraria;
using Terraria.ModLoader;
using Terraria.ModLoader.IO;

namespace PassTheWorld.Players;

/// <summary>
/// Keeps Pass the World saves out of play unless it's your turn: a tagged world or character
/// can only be entered while this client holds that game's turn.
/// </summary>
public class GatePlayer : ModPlayer
{
    /// <summary>The game this character belongs to (stored in the .tplr), or null.</summary>
    public string? PlayerGameId;

    public override void SaveData(TagCompound tag)
    {
        if (PlayerGameId != null) tag["gameId"] = PlayerGameId;
    }

    public override void LoadData(TagCompound tag)
    {
        PlayerGameId = tag.ContainsKey("gameId") ? tag.GetString("gameId") : null;
    }

    public override void OnEnterWorld()
    {
        var system = ModContent.GetInstance<TurnSystem>();
        bool holdingTurn = TurnSession.Active && !TurnSession.Ending;
        bool isTurnWorld = holdingTurn && Main.ActiveWorldFileData?.Path is { } worldPath && SamePath(worldPath, TurnSession.WorldPath!);
        bool isTurnPlayer = holdingTurn && Main.ActivePlayerFileData?.Path is { } playerPath && SamePath(playerPath, TurnSession.PlayerPath!);

        if (isTurnWorld && isTurnPlayer)
        {
            PlayerGameId = TurnSession.GameId;
            system.OnTurnWorldEntered();
            return;
        }

        Messages.GateReason? reason = null;
        if (system.WorldGameId != null) reason = Messages.GateReason.ManagedWorld;
        else if (PlayerGameId != null) reason = Messages.GateReason.ManagedCharacter;
        else if (isTurnWorld || isTurnPlayer) reason = Messages.GateReason.WrongPairing;
        if (reason == null) return;

        Main.NewText(Messages.Chat.Blocked(reason.Value), Color.OrangeRed);
        system.KickPending = true; // handled next tick in TurnSystem; quitting from inside OnEnterWorld is unsafe
    }

    private static bool SamePath(string a, string b) => System.IO.Path.GetFullPath(a) == System.IO.Path.GetFullPath(b);
}
