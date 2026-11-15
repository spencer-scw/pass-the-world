using System;
using PassTheWorld.Common.Api;

namespace PassTheWorld.Common;

/// <summary>The turn this client currently holds. Server time is authoritative; we track the clock offset.</summary>
public static class TurnSession
{
    public static string? GameId { get; private set; }
    public static string? TurnId { get; private set; }
    public static int TurnSeq { get; private set; }

    /// <summary>The game's save, copied into the normal folders for this turn.</summary>
    public static StagedSave? Staged { get; private set; }

    /// <summary>Paths of the staged world and character being played.</summary>
    public static string? WorldPath => Staged?.WorldPath;
    public static string? PlayerPath => Staged?.PlayerPath;

    private static DateTime _deadlineUtc;
    private static TimeSpan _clockOffset;

    /// <summary>Set once we've started saving and quitting at the end of the turn.</summary>
    public static volatile bool Ending;

    public static bool Active => TurnId != null;

    public static TimeSpan Remaining => _deadlineUtc - (DateTime.UtcNow + _clockOffset);

    public static void Begin(ClaimDto claim, StagedSave staged)
    {
        GameId = claim.GameId;
        TurnId = claim.Turn.Id;
        TurnSeq = claim.Turn.Seq;
        Staged = staged;
        Ending = false;
        UpdateClock(claim.DeadlineAt, claim.ServerNow);
    }

    public static void UpdateClock(long deadlineAtMs, long serverNowMs)
    {
        _deadlineUtc = DateTimeOffset.FromUnixTimeMilliseconds(deadlineAtMs).UtcDateTime;
        _clockOffset = DateTimeOffset.FromUnixTimeMilliseconds(serverNowMs).UtcDateTime - DateTime.UtcNow;
    }

    public static void Clear()
    {
        GameId = TurnId = null;
        Staged = null;
        TurnSeq = 0;
        Ending = false;
    }
}
