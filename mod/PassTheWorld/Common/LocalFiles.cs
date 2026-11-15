#nullable enable
using System;
using System.IO;
using System.Text.Json;
using PassTheWorld.Common.Api;
using Terraria;

namespace PassTheWorld.Common;

/// <summary>Everything the mod persists lives under tModLoader/PassTheWorld/.</summary>
internal static class LocalFiles
{
    public static string Root => RootProvider();

    // Swappable so the file logic can be tested outside the game.
    internal static Func<string> RootProvider = () => Path.Combine(Main.SavePath, "PassTheWorld");

    public static T? Read<T>(string name) where T : class
    {
        try
        {
            var path = Path.Combine(Root, name);
            return File.Exists(path) ? JsonSerializer.Deserialize<T>(File.ReadAllText(path), PtwApi.Json) : null;
        }
        catch (Exception e)
        {
            PassTheWorld.Instance.Logger.Warn($"Could not read {name}: {e.Message}");
            return null;
        }
    }

    public static void Write<T>(string name, T value)
    {
        Directory.CreateDirectory(Root);
        File.WriteAllText(Path.Combine(Root, name), JsonSerializer.Serialize(value, PtwApi.Json));
    }

    public static void Delete(string name)
    {
        var path = Path.Combine(Root, name);
        if (File.Exists(path)) File.Delete(path);
    }
}

/// <summary>
/// The mod's API token. Kept in its own file rather than a ModConfig, since configs are easy to share by accident.
/// </summary>
public static class TokenStore
{
    private const string FileName = "auth.json";
    private sealed record Stored(string Token, string? DisplayName);

    private static Stored? _cached;
    private static bool _loaded;

    private static Stored? Current
    {
        get
        {
            if (!_loaded)
            {
                _cached = LocalFiles.Read<Stored>(FileName);
                _loaded = true;
            }
            return _cached;
        }
    }

    public static string? Token => Current?.Token;
    public static string? DisplayName => Current?.DisplayName;

    public static void Save(string token, string? displayName)
    {
        _cached = new Stored(token, displayName);
        _loaded = true;
        LocalFiles.Write(FileName, _cached);
    }

    public static void Clear()
    {
        _cached = null;
        _loaded = true;
        LocalFiles.Delete(FileName);
    }
}

/// <summary>
/// Remembers which turn this machine is in the middle of, so a resume after a crash or restart
/// can use the (newer) stored save instead of re-downloading the last checkpoint.
/// </summary>
public sealed record LocalTurnState(string GameId, string TurnId)
{
    private const string FileName = "current-turn.json";
    public static LocalTurnState? Load() => LocalFiles.Read<LocalTurnState>(FileName);
    public void Save() => LocalFiles.Write(FileName, this);
    public static void Clear() => LocalFiles.Delete(FileName);
}
