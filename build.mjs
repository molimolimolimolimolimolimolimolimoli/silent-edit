import { readFile, writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";
import { build } from "esbuild";

const manifest = JSON.parse(await readFile("./manifest.json"));
await mkdir("./dist", { recursive: true });

try {
    await build({
        entryPoints: [`./${manifest.main}`],
        bundle: true,
        minify: true,
        outfile: "./dist/index.js",
        format: "cjs",
        external: ["@vendetta", "@vendetta/*"],
        loader: { ".ts": "ts", ".tsx": "tsx" },
    });

    const toHash = await readFile("./dist/index.js");
    manifest.hash = createHash("sha256").update(toHash).digest("hex");
    manifest.main = "index.js";
    await writeFile("./dist/manifest.json", JSON.stringify(manifest));
    console.log("Built successfully!");
} catch (e) {
    console.error(e);
    process.exit(1);
}
