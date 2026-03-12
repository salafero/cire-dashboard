17:55:37.305 Running build in Portland, USA (West) – pdx1
17:55:37.305 Build machine configuration: 2 cores, 8 GB
17:55:37.315 Cloning github.com/salafero/cire-pos (Branch: main, Commit: 61fa2f1)
17:55:37.316 Skipping build cache, deployment was triggered without cache.
17:55:37.758 Cloning completed: 443.000ms
17:55:38.090 Running "vercel build"
17:55:38.707 Vercel CLI 50.28.0
17:55:39.245 Installing dependencies...
17:55:48.354 
17:55:48.354 added 75 packages in 9s
17:55:48.355 
17:55:48.355 7 packages are looking for funding
17:55:48.355   run `npm fund` for details
17:55:48.393 Running "npm run build"
17:55:48.490 
17:55:48.490 > cire-pos@1.0.0 build
17:55:48.490 > vite build
17:55:48.490 
17:55:48.803 [33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m
17:55:48.843 [36mvite v5.4.21 [32mbuilding for production...[36m[39m
17:55:48.893 transforming...
17:55:48.963 [32m✓[39m 4 modules transformed.
17:55:48.964 [31mx[39m Build failed in 97ms
17:55:48.965 [31merror during build:
17:55:48.965 [31m[vite:esbuild] Transform failed with 6 errors:
17:55:48.965 /vercel/path0/src/App.jsx:390:9: ERROR: The symbol "useState" has already been declared
17:55:48.965 /vercel/path0/src/App.jsx:390:19: ERROR: The symbol "useEffect" has already been declared
17:55:48.965 /vercel/path0/src/App.jsx:391:9: ERROR: The symbol "createClient" has already been declared
17:55:48.965 /vercel/path0/src/App.jsx:393:6: ERROR: The symbol "SUPABASE_URL" has already been declared
17:55:48.965 /vercel/path0/src/App.jsx:394:6: ERROR: The symbol "SUPABASE_KEY" has already been declared
17:55:48.965 ...[31m
17:55:48.965 file: [36m/vercel/path0/src/App.jsx:390:9[31m
17:55:48.965 [33m
17:55:48.965 [33mThe symbol "useState" has already been declared[33m
17:55:48.966 388|  }
17:55:48.966 389|  
17:55:48.966 390|  import { useState, useEffect } from "react";
17:55:48.966    |           ^
17:55:48.966 391|  import { createClient } from "@supabase/supabase-js";
17:55:48.966 392|  
17:55:48.966 
17:55:48.966 [33mThe symbol "useEffect" has already been declared[33m
17:55:48.966 388|  }
17:55:48.966 389|  
17:55:48.966 390|  import { useState, useEffect } from "react";
17:55:48.966    |                     ^
17:55:48.966 391|  import { createClient } from "@supabase/supabase-js";
17:55:48.966 392|  
17:55:48.966 
17:55:48.967 [33mThe symbol "createClient" has already been declared[33m
17:55:48.967 389|  
17:55:48.967 390|  import { useState, useEffect } from "react";
17:55:48.967 391|  import { createClient } from "@supabase/supabase-js";
17:55:48.967    |           ^
17:55:48.967 392|  
17:55:48.967 393|  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
17:55:48.967 
17:55:48.967 [33mThe symbol "SUPABASE_URL" has already been declared[33m
17:55:48.967 391|  import { createClient } from "@supabase/supabase-js";
17:55:48.967 392|  
17:55:48.967 393|  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
17:55:48.967    |        ^
17:55:48.967 394|  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
17:55:48.967 395|  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
17:55:48.967 
17:55:48.967 [33mThe symbol "SUPABASE_KEY" has already been declared[33m
17:55:48.967 392|  
17:55:48.967 393|  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
17:55:48.967 394|  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
17:55:48.968    |        ^
17:55:48.968 395|  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
17:55:48.968 396|  
17:55:48.968 
17:55:48.968 [33mThe symbol "supabase" has already been declared[33m
17:55:48.968 393|  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
17:55:48.968 394|  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
17:55:48.968 395|  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
17:55:48.968    |        ^
17:55:48.968 396|  
17:55:48.968 397|  // ─── SUCURSALES ───────────────────────────────────────────────────────────────
17:55:48.968 [31m
17:55:48.968     at failureErrorWithLog (/vercel/path0/node_modules/esbuild/lib/main.js:1472:15)
17:55:48.968     at /vercel/path0/node_modules/esbuild/lib/main.js:755:50
17:55:48.968     at responseCallbacks.<computed> (/vercel/path0/node_modules/esbuild/lib/main.js:622:9)
17:55:48.968     at handleIncomingPacket (/vercel/path0/node_modules/esbuild/lib/main.js:677:12)
17:55:48.968     at Socket.readFromStdout (/vercel/path0/node_modules/esbuild/lib/main.js:600:7)
17:55:48.969     at Socket.emit (node:events:508:28)
17:55:48.969     at addChunk (node:internal/streams/readable:559:12)
17:55:48.969     at readableAddChunkPushByteMode (node:internal/streams/readable:510:3)
17:55:48.969     at Readable.push (node:internal/streams/readable:390:5)
17:55:48.969     at Pipe.onStreamRead (node:internal/stream_base_commons:189:23)[39m
17:55:48.988 Error: Command "npm run build" exited with 1
