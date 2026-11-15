using System;

namespace PassTheWorld.Common;

/// <summary>
/// All player-facing text in the mod. Code calls these instead of embedding strings.
/// (If we ever want translations, these map cleanly onto tModLoader .hjson localization keys.)
/// </summary>
public static class Messages
{
    /// <summary>"1h 05m" above an hour, "4:09" below.</summary>
    public static string Duration(TimeSpan t)
    {
        if (t < TimeSpan.Zero) t = TimeSpan.Zero;
        return t.TotalHours >= 1 ? $"{(int)t.TotalHours}h {t.Minutes:D2}m" : $"{t.Minutes}:{t.Seconds:D2}";
    }

    private static string Kb(long bytes) => $"{bytes / 1024} KB";

    /// <summary>Lines posted to in-game chat while playing.</summary>
    public static class Chat
    {
        private const string Prefix = "[Pass the World]";

        public static string Format(string text) => $"{Prefix} {text}";

        public static string TurnStarted(int seq, TimeSpan remaining) =>
            Format($"Turn #{seq} started, {Duration(remaining)} on the clock. Have fun!");

        public static string MinutesLeft(int minutes) =>
            Format($"{minutes} minute{(minutes == 1 ? "" : "s")} left in your turn!");

        public static readonly string TimeUp = Format("Time's up! Saving and passing the world...");

        public static readonly string CheckpointSaved = Format("Checkpoint saved.");

        public static string CheckpointFailed(string error) =>
            Format($"Checkpoint upload failed ({error}). Will retry next interval.");

        public static string TurnEndedByServer(string reason) => Format($"Your turn was ended by the server: {reason}");

        public static string Blocked(GateReason reason) => Format($"{reason switch
        {
            GateReason.ManagedWorld => "This world belongs to a Pass the World game",
            GateReason.ManagedCharacter => "This character belongs to a Pass the World game",
            _ => "Your turn must be played with the game's character in the game's world",
        }}. Start your turn from the Pass the World menu.");
    }

    /// <summary>Why the gate kicked the player out of a world.</summary>
    public enum GateReason
    {
        ManagedWorld,
        ManagedCharacter,
        WrongPairing,
    }

    /// <summary>The status line at the bottom of the Pass the World menu.</summary>
    public static class Status
    {
        public static string Failed(string action, string error) => $"{action}: {error}";

        public const string LinkingFailed = "Linking failed";
        public const string StartFailed = "Couldn't start your turn";
        public const string UploadFailed = "Upload failed";

        // Account linking
        public static string EnterLinkCode(string code) => $"Enter code {code} on the website (opening in your browser)...";
        public static string Linked(string? name) => $"Linked as {name}.";
        public const string LinkCodeExpired = "The link code expired. Try again.";
        public const string Unlinked = "Unlinked.";

        // Game setup
        public static string StartingSaveNotFound(string playerName, string worldName) =>
            $"Create a (non-cloud) character named \"{playerName}\" and world named \"{worldName}\" first.";

        public const string UploadingStartingSave = "Uploading starting save...";

        public static string StartingSaveUploaded(long bytes) =>
            $"Starting save uploaded ({Kb(bytes)}) and moved out of your normal saves. Start the game from the website.";

        public static string StartingSaveNotMoved(long bytes, string error) =>
            $"Starting save uploaded ({Kb(bytes)}), but it couldn't be moved out of your normal saves ({error}). " +
            "Don't play it from the normal menus before the game starts.";

        // Starting a turn
        public const string Claiming = "Claiming turn...";
        public const string ResumingLocal = "Resuming from your local save...";
        public static string Downloading(long bytes) => $"Downloading save ({Kb(bytes)})...";
        public const string LoadingWorld = "Loading world...";
        public const string DownloadedFilesMissing = "Couldn't find the downloaded character/world files. Check the logs.";

        // Ending a turn
        public const string UploadingFinal = "Uploading your save...";

        public static string LeftMidTurn(TimeSpan remaining) =>
            $"You left mid-turn, {Duration(remaining)} left on the clock. Saving a checkpoint...";

        public static string MidTurnCheckpointSaved(TimeSpan remaining) =>
            $"Checkpoint saved. {Duration(remaining)} left on your turn; resume any time before it ends.";

        public static string CheckpointFailed(string error) => $"Checkpoint upload failed: {error}";

        public const string TurnSubmitted = "Turn submitted. Thanks for playing! The world has been passed on.";
        public static string FinalRejected(string error) => $"The server didn't accept the final save: {error}";
        public static string FinalRetrying(string error, int attempt, int max) => $"Upload failed ({error}), retrying ({attempt}/{max})...";
        public const string FinalGaveUp = "Couldn't upload your final save. Use \"Retry upload\" before the grace period ends.";

        public static string ServerUnreachable(string error) => $"Couldn't reach the server: {error}";
    }

    /// <summary>Text in the Pass the World menu itself.</summary>
    public static class Menu
    {
        public const string Title = "Pass the World";
        public const string OpenButton = "Pass the World";

        public static string LinkedAs(string? name) => $"Linked as {name ?? "you"}";
        public const string NotLinked = "Not linked to an account";

        public const string Back = "Back";
        public const string Refresh = "Refresh";
        public const string Unlink = "Unlink";
        public const string LinkAccount = "Link account";
        public const string Linking = "Linking...";
        public const string StartTurn = "Start turn";
        public const string ResumeTurn = "Resume turn";
        public const string RetryUpload = "Retry upload";
        public static string UploadStartingSave(bool replacing) => replacing ? "Replace starting save" : "Upload starting save";

        public const string LinkPrompt = "Link this game to your Pass the World account to see your games.";
        public const string Loading = "Loading...";
        public const string NoData = "No data yet.";
        public const string NoGames = "You're not in any games yet. Join one from an invite link on the website.";
        public const string FinalPendingTitle = "Final upload pending";
        public const string FinalPendingBody = "Your turn ended but the save didn't upload.";

        // One-line status for each game row
        public static string SetupNeedsSave(string playerName, string worldName) =>
            $"Setting up. Create character \"{playerName}\" and world \"{worldName}\", then upload.";

        public const string SetupReady = "Setting up. Starting save uploaded; start the game on the website.";
        public const string Paused = "Paused by the host.";
        public const string NoOpenTurn = "No turn is open right now.";

        public static string TimeLeft(TimeSpan left) =>
            left > TimeSpan.Zero ? $"{(int)left.TotalMinutes} min left" : "finishing up";

        public static string YouAreMidTurn(int seq, TimeSpan left) => $"You're mid-turn #{seq} ({TimeLeft(left)}).";
        public static string SomeoneIsPlaying(string? name, int seq, TimeSpan left) => $"{name} is playing turn #{seq} ({TimeLeft(left)}).";
        public static string YourTurn(int seq) => $"Turn #{seq}: it's your turn!";
        public static string WaitingOn(int seq, string name) => $"Turn #{seq}: waiting on {name}.";
        public static string UpForGrabs(int seq) => $"Turn #{seq}: up for grabs (you went last).";
    }

    /// <summary>The countdown drawn at the top of the screen.</summary>
    public static class Hud
    {
        public static string TurnEndsIn(TimeSpan remaining) => $"Turn ends in {Duration(remaining)}";
        public const string Passing = "Passing the world...";
    }

    /// <summary>Errors surfaced to the player through the status line.</summary>
    public static class Errors
    {
        public const string NotLinked = "Link your account first.";
        public const string NoTurnAvailable = "No turn available";
        public const string IntegrityCheckFailed = "The downloaded save failed its integrity check. Try again.";
        public const string DownloadFailed = "Download failed";
        public const string RequestFailed = "Request failed";
        public const string EmptyResponse = "Empty response";
    }
}
