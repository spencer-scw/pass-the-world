using System;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using PassTheWorld.Common.Api;

namespace PassTheWorld.Common;

public sealed record BundleManifest(int Version, string? GameId, int TurnSeq, string WorldFile, string PlayerFile, long CreatedAt);

/// <summary>
/// A save bundle is a zip of everything needed to hand the world and character to the next player:
///
///   Worlds/&lt;world&gt;.wld, .twld        world + modded world data
///   Players/&lt;player&gt;.plr, .tplr      character + modded character data
///   Players/&lt;player&gt;/*.map, *.tmap  explored map (without these, the next player sees a black map)
///   ptw.json                        manifest
/// </summary>
public static class SaveBundle
{
    private const string ManifestName = "ptw.json";

    public static string Sha256Hex(byte[] data) => Convert.ToHexString(SHA256.HashData(data)).ToLowerInvariant();

    /// <summary>Bundles the save at the given paths, naming the files inside the zip by the canonical names.</summary>
    public static byte[] Create(string worldPath, string playerPath, string worldFile, string playerFile, string? gameId, int turnSeq)
    {

        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            AddFile(zip, worldPath, $"Worlds/{worldFile}.wld", required: true);
            AddFile(zip, Path.ChangeExtension(worldPath, ".twld"), $"Worlds/{worldFile}.twld", required: false);
            AddFile(zip, playerPath, $"Players/{playerFile}.plr", required: true);
            AddFile(zip, Path.ChangeExtension(playerPath, ".tplr"), $"Players/{playerFile}.tplr", required: false);

            // The map folder sits next to the .plr and is named after it (whatever it's called on disk right now).
            var mapDir = Path.Combine(Path.GetDirectoryName(playerPath)!, Path.GetFileNameWithoutExtension(playerPath));
            if (Directory.Exists(mapDir))
            {
                foreach (var file in Directory.EnumerateFiles(mapDir, "*", SearchOption.AllDirectories))
                {
                    if (file.EndsWith(".bak", StringComparison.OrdinalIgnoreCase)) continue;
                    var rel = Path.GetRelativePath(mapDir, file).Replace('\\', '/');
                    AddFile(zip, file, $"Players/{playerFile}/{rel}", required: true);
                }
            }

            var manifest = new BundleManifest(1, gameId, turnSeq, worldFile, playerFile, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            using var writer = new StreamWriter(zip.CreateEntry(ManifestName).Open());
            writer.Write(JsonSerializer.Serialize(manifest, PtwApi.Json));
        }
        return ms.ToArray();
    }

    /// <summary>Unpacks a bundle into &lt;root&gt;/Worlds and &lt;root&gt;/Players.</summary>
    public static BundleManifest Extract(byte[] zipBytes, string root)
    {
        using var zip = new ZipArchive(new MemoryStream(zipBytes), ZipArchiveMode.Read);
        var manifestEntry = zip.GetEntry(ManifestName) ?? throw new InvalidDataException("Save bundle has no manifest");
        BundleManifest manifest;
        using (var s = manifestEntry.Open())
            manifest = JsonSerializer.Deserialize<BundleManifest>(s, PtwApi.Json) ?? throw new InvalidDataException("Bad manifest");

        foreach (var entry in zip.Entries)
        {
            if (entry.FullName == ManifestName || entry.FullName.EndsWith('/')) continue;
            var target = ResolveTarget(root, entry.FullName);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            entry.ExtractToFile(target, overwrite: true);
        }
        return manifest;
    }

    /// <summary>Resolves "Worlds/x" and "Players/x" under root, rejecting anything that escapes those folders.</summary>
    private static string ResolveTarget(string root, string entryName)
    {
        if (!entryName.StartsWith("Worlds/") && !entryName.StartsWith("Players/"))
            throw new InvalidDataException($"Unexpected file in save bundle: {entryName}");

        var folder = Path.Combine(root, entryName[..entryName.IndexOf('/')]);
        var rootFull = Path.GetFullPath(folder) + Path.DirectorySeparatorChar;
        var full = Path.GetFullPath(Path.Combine(root, entryName));
        if (!full.StartsWith(rootFull, StringComparison.Ordinal))
            throw new InvalidDataException($"Unsafe path in save bundle: {entryName}");
        return full;
    }

    private static void AddFile(ZipArchive zip, string path, string entryName, bool required)
    {
        if (!File.Exists(path))
        {
            if (required) throw new FileNotFoundException($"Missing save file: {path}");
            return;
        }
        // FileShare.ReadWrite: the game may still hold a handle on a file it just wrote.
        using var src = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var dst = zip.CreateEntry(entryName, CompressionLevel.Optimal).Open();
        src.CopyTo(dst);
    }
}
