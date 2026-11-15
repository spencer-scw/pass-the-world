#nullable enable
using System;
using System.Linq;
using PassTheWorld.Common;
using PassTheWorld.UI;
using Terraria;
using Terraria.GameContent.UI.States;
using Terraria.ModLoader;

namespace PassTheWorld.Systems;

/// <summary>Detours into vanilla code: the menu entry point and the save-and-quit completion callback.</summary>
public class HookSystem : ModSystem
{
    public override void Load()
    {
        if (Main.dedServ) return;
        On_UICharacterSelect.OnActivate += AddMenuButton;
        On_WorldGen.SaveAndQuit += WrapSaveAndQuit;

        // If the game crashed or was closed mid-turn, the staged copy is still in the normal folders. No world can be
        // loaded while mods load, so this is a safe moment to move it back into storage.
        try
        {
            SaveStore.RecoverStaged();
        }
        catch (Exception e)
        {
            PassTheWorld.Instance.Logger.Error("[PassTheWorld] couldn't recover a staged save", e);
        }
    }

    public override void Unload()
    {
        if (Main.dedServ) return;
        // Vanilla's character select screen outlives this mod; leave nothing of ours attached to it.
        try
        {
            PtwMenuButton.RemoveFromScreen();
        }
        catch (Exception e)
        {
            PassTheWorld.Instance?.Logger.Warn("[PassTheWorld] couldn't remove the menu button on unload", e);
        }
    }

    /// <summary>Adds a "Pass the World" button to the character select screen.</summary>
    private static void AddMenuButton(On_UICharacterSelect.orig_OnActivate orig, UICharacterSelect self)
    {
        orig(self);
        PtwMenuButton.AddTo(self);
    }

    /// <summary>Runs our upload logic after vanilla has finished writing the world and player to disk.</summary>
    private static void WrapSaveAndQuit(On_WorldGen.orig_SaveAndQuit orig, Action callback)
    {
        orig(() =>
        {
            callback?.Invoke();
            try
            {
                TurnFlow.OnSavedAndQuit();
            }
            catch (Exception e)
            {
                PassTheWorld.Instance.Logger.Error("[PassTheWorld] post-save handling failed", e);
            }
        });
    }
}
