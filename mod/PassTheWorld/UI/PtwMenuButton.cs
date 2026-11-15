#nullable enable
using System;
using System.Linq;
using System.Reflection;
using Microsoft.Xna.Framework;
using PassTheWorld.Common;
using Terraria.Audio;
using Terraria.GameContent;
using Terraria.GameContent.UI.Elements;
using Terraria.GameContent.UI.States;
using Terraria.ID;
using Terraria.UI;

namespace PassTheWorld.UI;

/// <summary>A vanilla-styled menu button.</summary>
public class PtwButton : UITextPanel<string>
{
    private static readonly Color Idle = new Color(63, 82, 151) * 0.8f;
    private static readonly Color Hover = new(73, 94, 171);

    public PtwButton(string text, Action onClick, float width = 200f, float textScale = 0.8f, bool large = false)
        : base(text, textScale, large)
    {
        Width.Set(width, 0f);
        Height.Set(40f, 0f);
        BackgroundColor = Idle;
        OnMouseOver += (_, _) =>
        {
            BackgroundColor = Hover;
            BorderColor = Colors.FancyUIFatButtonMouseOver;
            SoundEngine.PlaySound(SoundID.MenuTick);
        };
        OnMouseOut += (_, _) =>
        {
            BackgroundColor = Idle;
            BorderColor = Color.Black;
        };
        OnLeftClick += (_, _) =>
        {
            SoundEngine.PlaySound(SoundID.MenuOpen);
            onClick();
        };
    }
}

/// <summary>
/// The entry point on the character select screen: a third button in vanilla's bottom row,
/// so the row reads Back | Pass the World | New.
/// </summary>
public class PtwMenuButton : PtwButton
{
    private const float VanillaTextScale = 0.7f; // what vanilla's Back/New buttons use

    // Vanilla keeps these private; if a tModLoader update renames them we fall back to a corner placement.
    private static readonly FieldInfo? BackPanelField =
        typeof(UICharacterSelect).GetField("_backPanel", BindingFlags.Instance | BindingFlags.NonPublic);
    private static readonly FieldInfo? NewPanelField =
        typeof(UICharacterSelect).GetField("_newPanel", BindingFlags.Instance | BindingFlags.NonPublic);

    private PtwMenuButton() : base(Messages.Menu.OpenButton, PtwMenuState.Open, textScale: VanillaTextScale, large: true) { }

    // The vanilla screen survives mod reloads, so we remember where we put the button to take it back out on unload.
    private static WeakReference<UICharacterSelect>? _screen;

    /// <summary>Adds the button to the character select screen. Safe to call every time the screen opens.</summary>
    public static void AddTo(UICharacterSelect screen)
    {
        _screen = new WeakReference<UICharacterSelect>(screen);
        var back = BackPanelField?.GetValue(screen) as UIElement;
        var next = NewPanelField?.GetValue(screen) as UIElement;

        // A button left behind by a previous load of this mod still runs that (unloaded) build's code. Remove it.
        RemoveStale(screen);
        if (back?.Parent is { } parent) RemoveStale(parent);

        if (back?.Parent is { } row && next?.Parent == row)
        {
            if (row.Children.Any(c => c is PtwMenuButton)) return;

            // Split vanilla's two half-width buttons into thirds and put ours in the middle.
            back.Width.Set(-10f, 1f / 3f);
            next.Width.Set(-10f, 1f / 3f);
            var button = new PtwMenuButton { HAlign = 0.5f, VAlign = back.VAlign, Top = back.Top, Height = back.Height };
            button.Width.Set(-10f, 1f / 3f);
            row.Append(button);
            row.Recalculate();
            return;
        }

        // Fallback: top-right corner, clear of the logo and the player list.
        if (screen.Children.Any(c => c is PtwMenuButton)) return;
        var corner = new PtwMenuButton { HAlign = 1f };
        corner.Width.Set(260f, 0f);
        corner.Height.Set(50f, 0f);
        corner.Top.Set(16f, 0f);
        corner.Left.Set(-16f, 0f);
        screen.Append(corner);
    }

    /// <summary>On unload: take our button back out and give vanilla's buttons their original widths.</summary>
    public static void RemoveFromScreen()
    {
        if (_screen == null || !_screen.TryGetTarget(out var screen)) return;
        var back = BackPanelField?.GetValue(screen) as UIElement;
        var next = NewPanelField?.GetValue(screen) as UIElement;
        foreach (var owner in new[] { screen, back?.Parent })
            foreach (var child in owner?.Children.Where(c => c.GetType().FullName == typeof(PtwMenuButton).FullName).ToList() ?? [])
                owner!.RemoveChild(child);
        back?.Width.Set(-10f, 0.5f);
        next?.Width.Set(-10f, 0.5f);
        back?.Parent?.Recalculate();
        _screen = null;
    }

    /// <summary>Removes buttons whose type has our name but comes from another (older) load of the mod.</summary>
    private static void RemoveStale(UIElement owner)
    {
        var stale = owner.Children
            .Where(c => c.GetType().FullName == typeof(PtwMenuButton).FullName && c.GetType() != typeof(PtwMenuButton))
            .ToList();
        foreach (var child in stale) owner.RemoveChild(child);
    }

    /// <summary>Shrinks the large text to fit when the button is narrower than the label (a third of the row is ~200px).</summary>
    public override void Recalculate()
    {
        base.Recalculate();
        var available = GetInnerDimensions().Width;
        var needed = FontAssets.DeathText.Value.MeasureString(Text).X;
        if (available <= 0 || needed <= 0) return;
        var fitted = Math.Min(VanillaTextScale, available / needed * 0.95f);
        if (Math.Abs(fitted - TextScale) > 0.01f) TextScale = fitted;
    }
}
