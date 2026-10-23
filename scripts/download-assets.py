"""Download public Podium media from the captured CMS JSON, without executing it."""

import concurrent.futures
import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / ".clone-ui/source"
MEDIA = ROOT / "public/media"
MANIFEST = ROOT / ".clone-ui/plan/assets.json"
OUTPUT = ROOT / "src/data/site-content.json"


def read(name):
    return json.loads((SOURCE / f"{name}.json").read_text())


data = {
    "projects": read("projects"),
    "mosaic": read("homeMosaicMedias"),
    "carousel": read("homeWorldwideCarousel"),
}
urls = set()


def collect_images(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if isinstance(child, str) and child.startswith("https://"):
                path = urllib.parse.urlparse(child).path.lower()
                if key == "thumbnailUrl" or (
                    key in {"src", "url"}
                    and re.search(r"\.(?:jpe?g|png|webp|avif|gif|svg)$", path)
                ):
                    urls.add(child)
            collect_images(child)
    elif isinstance(value, list):
        for child in value:
            collect_images(child)


def collect_loops(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key in {"url", "mp4Url"} and isinstance(child, str):
                if urllib.parse.urlparse(child).path.lower().endswith((".mp4", ".webm")):
                    urls.add(child)
            collect_loops(child)
    elif isinstance(value, list):
        for child in value:
            collect_loops(child)


collect_images(data)
for project in data["projects"]:
    collect_loops(project["projectPoster"])
collect_loops(data["mosaic"])
collect_loops(data["carousel"])


def filename(url):
    name = urllib.parse.unquote(urllib.parse.urlparse(url).path.rsplit("/", 1)[-1])
    name = re.sub(r"[^a-zA-Z0-9._-]", "-", name)
    return hashlib.sha256(url.encode()).hexdigest()[:12] + "-" + name


def download(url):
    name = filename(url)
    target = MEDIA / name
    if target.exists() and target.stat().st_size:
        return {"original": url, "local": f"/media/{name}", "bytes": target.stat().st_size, "status": "ok"}
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://podium.global/"})
            with urllib.request.urlopen(request, timeout=90) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}")
                content_type = response.headers.get("Content-Type", "")
                if "text/html" in content_type:
                    raise RuntimeError("Unexpected HTML response for media")
                temporary = target.with_name(name + ".part")
                with temporary.open("wb") as output:
                    while chunk := response.read(1024 * 1024):
                        output.write(chunk)
                temporary.replace(target)
            result = {"original": url, "local": f"/media/{name}", "bytes": target.stat().st_size, "status": "ok"}
            print(f"Downloaded {name} ({result['bytes']} bytes)", flush=True)
            return result
        except Exception as error:
            if attempt == 2:
                print(f"FAILED {url}: {error}", flush=True)
                return {"original": url, "local": None, "bytes": 0, "status": "failed", "error": str(error)}
            time.sleep(attempt + 1)


def normalize(value, mapping):
    if isinstance(value, dict):
        return {key: normalize(child, mapping) for key, child in value.items() if key not in {"base64", "srcSet"}}
    if isinstance(value, list):
        return [normalize(child, mapping) for child in value]
    if isinstance(value, str):
        return mapping.get(value, value)
    return value


if __name__ == "__main__":
    MEDIA.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"Preparing {len(urls)} media files", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        assets = list(pool.map(download, sorted(urls)))
    mapping = {asset["original"]: asset["local"] for asset in assets if asset["status"] == "ok"}
    summary = {"requested": len(assets), "downloaded": len(mapping), "failed": len(assets) - len(mapping), "bytes": sum(asset["bytes"] for asset in assets)}
    MANIFEST.write_text(json.dumps({"mapping": mapping, "assets": assets, "summary": summary}, indent=2) + "\n")
    OUTPUT.write_text(json.dumps(normalize(data, mapping), ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(summary), flush=True)
