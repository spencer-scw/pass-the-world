using System;
using Microsoft.Xna.Framework;
using Terraria.Audio;
using Terraria.GameContent.UI.Elements;
using PassTheWorld.Common;
using Terraria.ID;

namespace PassTheWorld.UI;

/// <summary>A vanilla-styled menu button.</summary>
public class PtwButton : UITextPanel<string>
{
    private static readonly Color Idle = new Color(63, 82, 151) * 0.8f;
    private static readonly Color Hover = new(73, 94, 171);

    public PtwButton(string text, Action onClick, float width = 200f, float textScale = 0.8f) : base(text, textScale)
    {
        Width.Set(width, 0f);
        Height.Set(40f, 0f);
        BackgroundColor = Idle;
        OnMouseOver += (_, _) =>
        {
            BackgroundColor = Hover;
            SoundEngine.PlaySound(SoundID.MenuTick);
        };
        OnMouseOut += (_, _) => BackgroundColor = Idle;
        OnLeftClick += (_, _) =>
        {
            SoundEngine.PlaySound(SoundID.MenuOpen);
            onClick();
        };
    }
}

/// <summary>The entry point we add to the top of the character select screen.</summary>
public class PtwMenuButton : PtwButton
{
    public PtwMenuButton() : base(Messages.Menu.OpenButton, PtwMenuState.Open, width: 260f, textScale: 0.9f)
    {
        HAlign = 0.5f;
        Top.Set(160f, 0f);
        Height.Set(44f, 0f);
    }
}
