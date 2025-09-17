exports.fetchWikiGameInfo = async (title) => {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) return null;
    const j = await r.json();
    return {
      title: j.title,
      summary: j.extract || "",
      thumbnail: (j.thumbnail && j.thumbnail.source) ? j.thumbnail.source : ""
    };
  } catch { return null; }
};
