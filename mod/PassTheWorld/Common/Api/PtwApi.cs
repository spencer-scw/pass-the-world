#nullable enable
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace PassTheWorld.Common.Api;

public sealed class PtwApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

/// <summary>
/// Thin async client for the Pass the World API. Never call these from the game thread and block on them;
/// fire them from a Task and hop back with Main.QueueMainThreadAction when touching game state.
/// </summary>
public static class PtwApi
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(5) };
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static string BaseUrl => PtwConfig.Instance.ApiBaseUrl.TrimEnd('/');

    public static Task<DeviceStartDto> StartDeviceLink() =>
        Send<DeviceStartDto>(Request(HttpMethod.Post, "/device/start", auth: false));

    public static Task<DevicePollDto> PollDeviceLink(string deviceCode) =>
        Send<DevicePollDto>(Request(HttpMethod.Post, "/device/poll", new DevicePollRequestDto(deviceCode), auth: false));

    public static Task<ModGamesDto> GetGames() => Send<ModGamesDto>(Request(HttpMethod.Get, "/mod/games"));

    public static Task<ClaimDto> Claim(string turnId) => Send<ClaimDto>(Request(HttpMethod.Post, $"/turns/{turnId}/claim"));

    public static Task<HeartbeatDto> Heartbeat(string turnId) =>
        Send<HeartbeatDto>(Request(HttpMethod.Post, $"/turns/{turnId}/heartbeat"));

    public static Task<UploadedDto> UploadCheckpoint(string turnId, byte[] zip) => Upload($"/turns/{turnId}/checkpoint", zip);

    public static Task<UploadedDto> FinishTurn(string turnId, byte[] zip) => Upload($"/turns/{turnId}/finish", zip);

    public static Task<UploadedDto> UploadInitialSave(string gameId, byte[] zip) => Upload($"/games/{gameId}/snapshots/initial", zip);

    public static async Task<byte[]> DownloadSnapshot(string gameId, string snapshotId)
    {
        using var res = await Http.SendAsync(Request(HttpMethod.Get, $"/games/{gameId}/snapshots/{snapshotId}/download"));
        if (!res.IsSuccessStatusCode)
            throw new PtwApiException((int)res.StatusCode, ExtractError(await res.Content.ReadAsStringAsync()) ?? Messages.Errors.DownloadFailed);
        return await res.Content.ReadAsByteArrayAsync();
    }

    private static Task<UploadedDto> Upload(string path, byte[] zip)
    {
        var req = Request(HttpMethod.Put, path);
        req.Content = new ByteArrayContent(zip);
        req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/zip");
        req.Headers.Add("X-Content-SHA256", SaveBundle.Sha256Hex(zip));
        return Send<UploadedDto>(req);
    }

    private static HttpRequestMessage Request(HttpMethod method, string path, object? body = null, bool auth = true)
    {
        var req = new HttpRequestMessage(method, BaseUrl + path);
        if (auth)
        {
            var token = TokenStore.Token ?? throw new PtwApiException(401, Messages.Errors.NotLinked);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        if (body != null)
            req.Content = new StringContent(JsonSerializer.Serialize(body, Json), Encoding.UTF8, "application/json");
        return req;
    }

    private static async Task<T> Send<T>(HttpRequestMessage req)
    {
        using (req)
        using (var res = await Http.SendAsync(req))
        {
            var text = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode)
            {
                if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized && req.Headers.Authorization != null)
                    TokenStore.Clear(); // revoked or expired; force a re-link
                throw new PtwApiException((int)res.StatusCode, ExtractError(text) ?? res.ReasonPhrase ?? Messages.Errors.RequestFailed);
            }
            return JsonSerializer.Deserialize<T>(text, Json) ?? throw new PtwApiException(500, Messages.Errors.EmptyResponse);
        }
    }

    private static string? ExtractError(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("error", out var e) ? e.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
