#nullable enable
using System.ComponentModel;
using Terraria.ModLoader;
using Terraria.ModLoader.Config;

namespace PassTheWorld.Common;

public class PtwConfig : ModConfig
{
    public override ConfigScope Mode => ConfigScope.ClientSide;

    public static PtwConfig Instance => ModContent.GetInstance<PtwConfig>();

    public const string DefaultApiBaseUrl = "https://passtheworld.skrewt.dev/api";

    /// <summary>Base URL of the Pass the World API: the site's URL plus /api. Only change it for a self-hosted server.</summary>
    [DefaultValue(DefaultApiBaseUrl)]
    public string ApiBaseUrl = DefaultApiBaseUrl;

    /// <summary>How often to upload a mid-turn checkpoint so a crash doesn't lose the turn.</summary>
    [DefaultValue(10)]
    [Range(5, 30)]
    public int CheckpointMinutes = 10;
}
