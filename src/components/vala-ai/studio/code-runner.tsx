import { useEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCw } from "lucide-react";

type File = { file: string; code: string };
type Log = { level: "log" | "warn" | "error"; msg: string };

/** Runs agent-generated React/TS files inside a sandboxed iframe (no access to this app). */
function buildDoc(files: File[], token: string) {
  const payload = JSON.stringify(files).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
<style>body{margin:0;font-family:system-ui;background:#fff;color:#111}</style></head>
<body><div id="root"></div><script>
const TOKEN=${JSON.stringify(token)};
const send=(level,msg)=>parent.postMessage({__runner:TOKEN,level,msg:String(msg)},"*");
["log","warn","error"].forEach(l=>{const o=console[l];console[l]=(...a)=>{send(l,a.map(x=>typeof x==="object"?JSON.stringify(x):x).join(" "));o(...a)}});
addEventListener("error",e=>send("error",e.message));
addEventListener("unhandledrejection",e=>send("error",e.reason&&e.reason.message||e.reason));
(async()=>{try{
  const files=${payload};
  const norm=p=>p.replace(/^\\.?\\//,"").replace(/^src\\//,"").replace(/\\.(tsx?|jsx?)$/,"");
  const resolve=(from,spec)=>{
    if(spec.startsWith("@/"))return norm(spec.slice(2));
    const base=norm(from).split("/").slice(0,-1);
    for(const part of spec.split("/")){if(part===".."){base.pop()}else if(part!=="."){base.push(part)}}
    return base.join("/");
  };
  const byKey={};files.forEach(f=>{byKey[norm(f.file)]=f;const k=norm(f.file);if(k.endsWith("/index"))byKey[k.slice(0,-6)]=f;});
  const urls={};
  const compile=(key,stack=[])=>{
    if(urls[key])return urls[key];
    const f=byKey[key];if(!f)throw new Error("Missing file: "+key);
    if(stack.includes(key))throw new Error("Circular import: "+key);
    let out=Babel.transform(f.code,{filename:f.file,presets:[["typescript",{isTSX:true,allExtensions:true}],["react",{runtime:"automatic"}]]}).code;
    out=out.replace(/(from\\s*|import\\s*\\(\\s*|import\\s+)(["'])([^"']+)\\2/g,(m,pre,q,spec)=>{
      if(spec.startsWith(".")||spec.startsWith("@/")){const k=resolve(f.file,spec);if(!byKey[k]&&!/\\.css$/.test(spec))throw new Error(f.file+" imports missing "+spec);if(/\\.css$/.test(spec))return pre+q+"data:text/javascript,"+q;return pre+q+compile(k,[...stack,key])+q;}
      if(/\\.css$/.test(spec))return pre+q+"data:text/javascript,"+q;
      if(spec==="react/jsx-runtime")return pre+q+"https://esm.sh/react@18/jsx-runtime"+q;
      return pre+q+"https://esm.sh/"+spec+(spec.startsWith("react")?"@18":"")+"?deps=react@18"+q;
    });
    return urls[key]=URL.createObjectURL(new Blob([out],{type:"text/javascript"}));
  };
  const keys=Object.keys(byKey);
  const entry=keys.find(k=>/(^|\\/)App$/.test(k))||keys[keys.length-1];
  const mod=await import(compile(entry));
  const C=mod.default||Object.values(mod).find(v=>typeof v==="function");
  if(!C)throw new Error(entry+" has no component to render");
  const React=await import("https://esm.sh/react@18");
  const {createRoot}=await import("https://esm.sh/react-dom@18/client?deps=react@18");
  createRoot(document.getElementById("root")).render(React.createElement(C));
  setTimeout(()=>send("log","Rendered "+entry+" · "+document.body.innerText.trim().split(/\\s+/).filter(Boolean).length+" words on screen"),800);
}catch(e){send("error",e.message||e)}})();
</script></body></html>`;
}

export function CodeRunner({ files }: { files: File[] }) {
  const [run, setRun] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const token = useMemo(() => Math.random().toString(36).slice(2), [run]);
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || e.data?.__runner !== token) return;
      setLogs((l) => [...l, { level: e.data.level, msg: e.data.msg }].slice(-50));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [token]);

  if (!files.length) return null;
  const errors = logs.filter((l) => l.level === "error").length;

  return (
    <div className="mt-4 rounded-md border border-studio-line bg-background">
      <div className="flex items-center gap-2 border-b border-studio-line px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[.18em] text-studio-faint">
          Run output
        </span>
        {run > 0 && (
          <span
            className={`font-mono text-[10px] ${errors ? "text-studio-fail" : "text-studio-ok"}`}
          >
            {errors ? `${errors} error${errors > 1 ? "s" : ""}` : "running OK"}
          </span>
        )}
        <button
          onClick={() => {
            setLogs([]);
            setRun((r) => r + 1);
          }}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded border border-studio-line px-2.5 text-[12px] hover:bg-studio-raise"
        >
          {run ? <RotateCw className="size-3.5" /> : <Play className="size-3.5" />}
          {run ? "Run again" : "Run code"}
        </button>
      </div>
      {run > 0 && (
        <>
          <iframe
            key={token}
            ref={ref}
            title="Generated app output"
            sandbox="allow-scripts"
            srcDoc={buildDoc(files, token)}
            className="h-72 w-full bg-foreground"
          />
          <ul className="max-h-36 overflow-auto border-t border-studio-line px-3 py-2 font-mono text-[11px]">
            {logs.length === 0 && <li className="text-studio-faint">Chal raha hai…</li>}
            {logs.map((l, i) => (
              <li
                key={i}
                className={
                  l.level === "error"
                    ? "text-studio-fail"
                    : l.level === "warn"
                      ? "text-accent"
                      : "text-studio-dim"
                }
              >
                › {l.msg}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
