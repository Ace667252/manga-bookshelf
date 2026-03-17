
import { useState, useEffect } from "react";
import { motion, Reorder } from "framer-motion";

// ---------------- SPINE REGISTRY ----------------

const spineRegistry = {
  naruto: {
    total: 72,
    sprite: "https://raw.githubusercontent.com/manga-spines/naruto/main/naruto-spines.png",
    spineWidth: 42
  },
  "dragon ball": {
    total: 42,
    base: "https://raw.githubusercontent.com/manga-spines/dragonball/main/",
    ext: "png"
  },
  "death note": {
    total: 12,
    base: "https://raw.githubusercontent.com/manga-spines/deathnote/main/",
    ext: "png"
  },
  "chainsaw man": {
    total: 16
  }
};

const spineCache = {};
let userSpriteRegistry = {};

try {
  const saved = localStorage.getItem("manga_spine_registry");
  if (saved) userSpriteRegistry = JSON.parse(saved);
} catch {}

function normalizeSeries(name) {
  return name
    .toLowerCase()
    .replace(/:.*$/g, "")
    .replace(/vol.*$/i, "")
    .replace(/volume.*$/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------- GOOGLE SEARCH ----------------

async function searchSeriesTitle(title) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(
        title
      )}+manga`
    );

    const data = await res.json();
    if (!data.items) return [];

    return data.items.slice(0, 10).map((item) => {
      const info = item.volumeInfo;
      const title = info.title || "Unknown";

      const volumeMatch = title.match(/(vol|volume)\.?\s*(\d+)/i);
      const volume = volumeMatch ? parseInt(volumeMatch[2]) : 1;

      const rawSeries = title.replace(/(vol|volume).*$/i, "").trim();
      const series = normalizeSeries(rawSeries);

      return {
        title,
        volume,
        series,
        isbn: item.id,
        cover: info.imageLinks?.thumbnail?.replace("http://", "https://")
      };
    });
  } catch {
    return [];
  }
}

// ---------------- SPINE LOOKUP ----------------

async function findSpine(series, volume) {
  const key = `${series}-${volume}`;
  if (spineCache[key]) return spineCache[key];

  const registry = spineRegistry[series];

  if (registry?.base) {
    const url = `${registry.base}${volume}.${registry.ext || "png"}`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        spineCache[key] = { type: "image", url };
        return spineCache[key];
      }
    } catch {}
  }

  if (registry?.sprite) {
    const cropX = (volume - 1) * registry.spineWidth;

    const sprite = {
      type: "sprite",
      url: registry.sprite,
      x: cropX,
      width: registry.spineWidth
    };

    spineCache[key] = sprite;
    return sprite;
  }

  return null;
}

// ---------------- SPINE COMPONENT ----------------

function Spine({ book, index }) {
  const [spineData, setSpineData] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const data = await findSpine(book.series, book.volume);
      if (mounted) setSpineData(data);
    }

    load();
    return () => (mounted = false);
  }, [book.series, book.volume]);

  return (
    <motion.div
      layout
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      whileHover={{ rotateY: -12, scale: 1.05 }}
      className="relative h-52 shadow-lg overflow-hidden bg-neutral-700"
      style={{ width: 28 }}
    >
      {spineData?.type === "image" && (
        <img src={spineData.url} className="absolute inset-0 w-full h-full object-cover" />
      )}

      {spineData?.type === "sprite" && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${spineData.url})`,
            backgroundPosition: `-${spineData.x}px 0`,
            backgroundSize: "auto 100%"
          }}
        />
      )}

      {!spineData && book.cover && (
        <img src={book.cover} className="absolute inset-0 w-full h-full object-cover opacity-60" />
      )}
    </motion.div>
  );
}

// ---------------- MAIN APP ----------------

export default function MangaBookshelf() {
  const [input, setInput] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [shelves, setShelves] = useState(() => {
    try {
      const saved = localStorage.getItem("manga_shelves");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [[]];
  });

  const [activeShelf, setActiveShelf] = useState(0);

  const handleSearch = async () => {
    if (!input) return;
    const results = await searchSeriesTitle(input);
    setSearchResults(results);
  };

  const addBook = (book) => {
    const updated = [...shelves];
    const shelf = updated[activeShelf];

    if (!shelf.some(b => b.series === book.series && b.volume === book.volume)) {
      shelf.push(book);
    }

    shelf.sort((a,b)=>{
      if(a.series===b.series) return a.volume-b.volume;
      return a.series.localeCompare(b.series);
    });

    setShelves(updated);
    setSearchResults([]);
  };

  useEffect(()=>{
    localStorage.setItem("manga_shelves", JSON.stringify(shelves));
  },[shelves]);

  return (
    <div style={{padding:40,background:"#111",minHeight:"100vh",color:"white"}}>
      <h1>Universal Manga Bookshelf</h1>

      <div style={{marginBottom:20}}>
        <input
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          placeholder="Search manga title"
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      {searchResults.map((b,i)=>(
        <div key={i} onClick={()=>addBook(b)} style={{cursor:"pointer"}}>
          {b.title}
        </div>
      ))}

      <div style={{display:"flex",gap:10,marginTop:40}}>
        {shelves.map((_,i)=>(
          <button key={i} onClick={()=>setActiveShelf(i)}>Shelf {i+1}</button>
        ))}
      </div>

      <div style={{display:"flex",alignItems:"flex-end",gap:4,marginTop:30}}>
        <Reorder.Group axis="x" values={shelves[activeShelf]} onReorder={(v)=>{
          const updated=[...shelves];
          updated[activeShelf]=v;
          setShelves(updated);
        }}>
          {shelves[activeShelf].map((book,index)=>(
            <Reorder.Item key={book.isbn+index} value={book}>
              <Spine book={book} index={index} />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    </div>
  );
}
