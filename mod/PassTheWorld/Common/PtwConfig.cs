#nullable enable
using System.ComponentModel;
using Terraria.ModLoader;
using Terraria.ModLoader.Config;

namespace PassTheWorld.Common;

public class PtwConfig : ModConfig
{
    public override ConfigScope Mode => ConfigScope.ClientSide;

    public static PtwConfig Instance => ModContent.GetInstance<PtwConfig>();

    /// <summary>Base URL of the Pass the World API: the site's URL plus /api, e.g. https://ptw.example.com/api</summary>
    [DefaultValue("http://localhost:8787/api")]
    public string ApiBaseUrl = "http://localhost:8787/api";

    /// <summary>How often to upload a mid-turn checkpoint so a crash doesn't lose the turn.</summary>
    [DefaultValue(10)]
    [Range(5, 30)]
    public int CheckpointMinutes = 10;
}
