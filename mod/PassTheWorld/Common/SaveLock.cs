#nullable enable
namespace PassTheWorld.Common;

/// <summary>
/// One lock around every world and player save (see HookSystem), which checkpoints also hold while they save and
/// bundle the files.
/// <para>
/// Without it, a checkpoint and vanilla autosave (both every 10 minutes from entering the world, both on worker
/// threads) could run at the same moment. The game then fails to open the world file it's writing ("being used by
/// another process") and the unhandled exception crashes it. Saves just wait their turn instead. The lock is
/// re-entrant, so the checkpoint's own save calls pass straight through.
/// </para>
/// </summary>
public static class SaveLock
{
    public static readonly object Gate = new();
}
