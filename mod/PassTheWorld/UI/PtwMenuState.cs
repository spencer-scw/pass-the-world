#nullable enable
using System;
using System.Threading.Tasks;
using Microsoft.Xna.Framework;
using PassTheWorld.Common;
using PassTheWorld.Common.Api;
using Terraria;
using Terraria.GameContent.UI.Elements;
using Terraria.UI;

namespace PassTheWorld.UI;

/// <summary>
/// Full-screen menu (menuMode 888 + Main.MenuUI) listing the player's games and what they can do in each.
/// Data is fetched on a background task and applied in Update() on the main thread.
/// </summary>
public class PtwMenuState : UIState
{
    private static PtwMenuState? _instance;

    private UIList _list = null!;
    private UIText _account = null!;
    private UIText _status = null!;
    private UIElement _buttons = null!;

    private volatile ModGamesDto? _fetched;
    private volatile string? _fetchError;
    private ModGamesDto? _games;
    private bool _loading;
    private bool _refreshQueued;
    private int _seenStatusVersion = -1;
    private int _seenGamesVersion = -1;
    private DateTime _nextAutoRefresh;

    public static void Open()
    {
        _instance ??= new PtwMenuState();
        Main.MenuUI.SetState(_instance);
        Main.menuMode = 888;
        _instance.Refresh();
    }

    public override void OnInitialize()
    {
        var root = new UIElement { HAlign = 0.5f };
        root.Width.Set(0f, 0.8f);
        root.MaxWidth.Set(720f, 0f);
        root.Top.Set(200f, 0f);
        root.Height.Set(-220f, 1f);
        Append(root);

        var panel = new UIPanel { BackgroundColor = new Color(33, 43, 79) * 0.8f };
        panel.Width.Set(0f, 1f);
        panel.Height.Set(-110f, 1f);
        root.Append(panel);

        // UIText centers within its own box, which doesn't resize when the text changes. Pin it full-width and
        // left-aligned so "Not linked to an account" can't spill past the panel edge.
        _account = new UIText("") { TextOriginX = 0f };
        _account.Width.Set(0f, 1f);
        panel.Append(_account);

        _list = new UIList { ListPadding = 8f };
        _list.Top.Set(32f, 0f);
        _list.Width.Set(-26f, 1f);
        _list.Height.Set(-32f, 1f);
        panel.Append(_list);

        var scrollbar = new UIScrollbar { HAlign = 1f };
        scrollbar.Top.Set(32f, 0f);
        scrollbar.Height.Set(-32f, 1f);
        _list.SetScrollbar(scrollbar);
        panel.Append(scrollbar);

        _status = new UIText("", 0.9f) { IsWrapped = true };
        _status.Top.Set(-100f, 1f);
        _status.Width.Set(0f, 1f);
        _status.Height.Set(44f, 0f);
        root.Append(_status);

        _buttons = new UIElement();
        _buttons.Top.Set(-46f, 1f);
        _buttons.Width.Set(0f, 1f);
        _buttons.Height.Set(46f, 0f);
        root.Append(_buttons);

        var title = new UITextPanel<string>(Messages.Menu.Title, 0.8f, true) { HAlign = 0.5f, BackgroundColor = new Color(73, 94, 171) };
        title.Top.Set(-46f, 0f);
        root.Append(title);
    }

    private void Refresh()
    {
        if (TokenStore.Token == null)
        {
            Rebuild();
            return;
        }
        if (_loading)
        {
            // A fetch is already running and may predate the change we need to see: fetch again when it lands.
            _refreshQueued = true;
            return;
        }
        _loading = true;
        _nextAutoRefresh = DateTime.UtcNow.AddSeconds(30);
        Task.Run(async () =>
        {
            try
            {
                _fetched = await PtwApi.GetGames();
                _fetchError = null;
            }
            catch (Exception e)
            {
                _fetchError = e.Message;
            }
            finally
            {
                _loading = false;
            }
        });
        Rebuild();
    }

    public override void Update(GameTime gameTime)
    {
        base.Update(gameTime);

        if (_fetched != null)
        {
            _games = _fetched;
            _fetched = null;
            Rebuild();
            if (_refreshQueued && !_loading)
            {
                _refreshQueued = false;
                Refresh();
            }
        }

        if (_seenGamesVersion != TurnFlow.GamesVersion)
        {
            // Something changed on the server (claimed, submitted, uploaded, linked): always re-fetch.
            _seenGamesVersion = TurnFlow.GamesVersion;
            Refresh();
        }
        else if (_seenStatusVersion != TurnFlow.Version)
        {
            // Only the status line or busy state changed: redraw.
            Rebuild();
        }
        else if (DateTime.UtcNow >= _nextAutoRefresh && !TurnFlow.Busy)
        {
            Refresh();
        }

        // Re-read every frame: some statuses count down.
        var status = _fetchError != null ? Messages.Status.ServerUnreachable(_fetchError) : TurnFlow.Status;
        if (status != _status.Text) _status.SetText(status);
    }

    private void Rebuild()
    {
        _seenStatusVersion = TurnFlow.Version;
        _list.Clear();
        _buttons.RemoveAllChildren();

        bool linked = TokenStore.Token != null;
        _account.SetText(linked ? Messages.Menu.LinkedAs(TokenStore.DisplayName) : Messages.Menu.NotLinked);

        AddBottomButton(Messages.Menu.Back, () => Main.OpenCharacterSelectUI(), 0f);
        if (linked)
        {
            AddBottomButton(Messages.Menu.Refresh, Refresh, 0.5f);
            AddBottomButton(Messages.Menu.Unlink, () =>
            {
                TurnFlow.Unlink();
                _games = null;
                Rebuild();
            }, 1f);
        }
        else
        {
            AddBottomButton(TurnFlow.Busy ? Messages.Menu.Linking : Messages.Menu.LinkAccount, TurnFlow.LinkAccount, 1f);
            _list.Add(Message(Messages.Menu.LinkPrompt));
            return;
        }

        if (TurnFlow.PendingFinal && TurnSession.Active)
            _list.Add(Row(Messages.Menu.FinalPendingTitle, Messages.Menu.FinalPendingBody, new PtwButton(Messages.Menu.RetryUpload, TurnFlow.RetryFinal, 180f)));

        if (_games == null)
        {
            _list.Add(Message(_loading ? Messages.Menu.Loading : Messages.Menu.NoData));
            return;
        }
        if (_games.Games.Count == 0)
            _list.Add(Message(Messages.Menu.NoGames));

        foreach (var g in _games.Games)
            _list.Add(GameRow(g, _games.User.Id));
    }

    private void AddBottomButton(string text, Action onClick, float hAlign)
    {
        _buttons.Append(new PtwButton(text, () =>
        {
            if (!TurnFlow.Busy) onClick();
        }, 200f) { HAlign = hAlign });
    }

    private static UIElement GameRow(ModGameDto g, string myId)
    {
        PtwButton? action = null;
        var t = g.CurrentTurn;

        string line;
        if (g.Status == GameStatus.Setup)
        {
            line = g.HasInitialSave ? Messages.Menu.SetupReady : Messages.Menu.SetupNeedsSave(g.PlayerName, g.WorldName);
            if (g.IsAdmin)
                action = new PtwButton(Messages.Menu.UploadStartingSave(g.HasInitialSave), () => Guard(() => TurnFlow.UploadInitialSave(g)), 220f);
        }
        else if (TurnSession.Ending && TurnSession.GameId == g.Id)
        {
            // Our final upload is still in flight (or waiting on "Retry upload"); the server hasn't moved on yet.
            line = Messages.Menu.SubmittingTurn(TurnSession.TurnSeq);
        }
        else if (g.Status == GameStatus.Paused) line = Messages.Menu.Paused;
        else if (t == null) line = Messages.Menu.NoOpenTurn;
        else if (t.Status == TurnStatus.Active)
        {
            // Ticks every frame, so the time left stays current between refreshes.
            var deadline = t.DeadlineAt is { } d ? DateTimeOffset.FromUnixTimeMilliseconds(d) : DateTimeOffset.UtcNow;
            var mine = t.UserId == myId;
            if (g.CanClaim) action = new PtwButton(Messages.Menu.ResumeTurn, () => Guard(() => TurnFlow.StartOrResume(g)), 180f);
            return Row(g.Name, () =>
            {
                var left = deadline - DateTimeOffset.UtcNow;
                return mine ? Messages.Menu.YouAreMidTurn(t.Seq, left) : Messages.Menu.SomeoneIsPlaying(t.UserName, t.Seq, left);
            }, action);
        }
        else if (g.CanClaim)
        {
            line = Messages.Menu.YourTurn(t.Seq);
            action = new PtwButton(Messages.Menu.StartTurn, () => Guard(() => TurnFlow.StartOrResume(g)), 180f);
        }
        else line = t.UserName != null ? Messages.Menu.WaitingOn(t.Seq, t.UserName) : Messages.Menu.UpForGrabs(t.Seq);

        return Row(g.Name, line, action);
    }

    private static void Guard(Action action)
    {
        if (!TurnFlow.Busy) action();
    }

    private static UIPanel Row(string title, string line, UIElement? action) => Row(title, () => line, action);

    private static UIPanel Row(string title, Func<string> line, UIElement? action)
    {
        var row = new UIPanel();
        row.Width.Set(0f, 1f);
        row.Height.Set(96f, 0f);

        // Text stops short of the action button and wraps onto a second line instead of running underneath it.
        var textWidth = action != null ? -(action.Width.Pixels + 16f) : 0f;

        var titleText = new UIText(title, 1f) { TextOriginX = 0f };
        titleText.Width.Set(textWidth, 1f);
        row.Append(titleText);

        var lineText = new LiveText(line, 0.85f) { TextColor = new Color(200, 200, 200), IsWrapped = true, TextOriginX = 0f };
        lineText.Top.Set(28f, 0f);
        lineText.Width.Set(textWidth, 1f);
        row.Append(lineText);

        if (action != null)
        {
            action.HAlign = 1f;
            action.VAlign = 0.5f;
            row.Append(action);
        }
        return row;
    }

    private static UIElement Message(string text)
    {
        var t = new UIText(text, 0.9f) { IsWrapped = true };
        t.Width.Set(0f, 1f);
        t.Height.Set(40f, 0f);
        return t;
    }

    /// <summary>Text that re-reads its content every frame (only re-lays out when it actually changes).</summary>
    private sealed class LiveText(Func<string> text, float textScale) : UIText(text(), textScale)
    {
        public override void Update(GameTime gameTime)
        {
            base.Update(gameTime);
            var current = text();
            if (current != Text) SetText(current);
        }
    }
}
