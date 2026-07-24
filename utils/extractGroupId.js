function extractGroupIdFromUrl(url) {
  const regex = /facebook\.com\/(?:groups|share\/g)\/([^/?#]+)/;
  const match = url.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

module.exports = { extractGroupIdFromUrl };
