# 上传到 GitHub

这个文件夹（`分子特调/`）就是完整的仓库内容，**把这个文件夹里的东西全部传上去就行**，不要连外面那层一起传。

---

## 方式一：网页拖拽（最快，不用装 git）

1. GitHub 右上角 **+ → New repository**
2. 名字建议填 `molecular-mixology`（中文名也能用，但 URL 会被转义成一串 `%E5%88%86…`）
3. **不要**勾 Add README / .gitignore / license（我们自带）
4. 建好后点 **uploading an existing file**
5. 打开 `分子特调` 文件夹，**全选里面的所有文件和文件夹**（`src`、`data`、`docs`、`screenshots`、`scripts`、`README.md`、`package.json`、`LICENSE`、`.gitignore` …）拖进浏览器
   - ⚠️ 要拖**里面的内容**，不要拖 `分子特调` 这个外层文件夹本身，否则仓库里会多一层
6. 下方 Commit changes 填一句 `first commit`，点提交

> `.gitignore` 和 `.npmrc` 是点开头的隐藏文件，Windows 资源管理器要开「显示隐藏项目」才看得见。漏了 `.gitignore` 的后果是后面 `node_modules` 可能被传上去。

---

## 方式二：命令行（推荐，之后好更新）

先装 git，然后在这个 `分子特调` 文件夹里：

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/你的用户名/molecular-mixology.git
git push -u origin main
```

以后再改就三条：

```bash
git add .
git commit -m "改了什么"
git push
```

---

## 传完检查三件事

1. 仓库首页能直接看到 README 的内容和**截图**（`screenshots/` 必须传上去，README 里是相对路径引用的）
2. 仓库里**没有** `node_modules/` 和 `dist/`（有 `.gitignore` 就不会有）
3. 点开 `data/compounds.json` 能看到内容——数据是这个项目的主体，别漏

---

## 建议加的仓库设置

- **About** 里填一句描述，比如：`以食品化学与调酒学为基础的风味工作台`
- **Topics**：`cocktail` `mixology` `food-chemistry` `flavor` `react` `vite` `typescript`
- 想让人在线试用，可以开 **Settings → Pages**，把 `dist/` 传到一个 `gh-pages` 分支（`vite.config.ts` 已经是 `base: "./"`，静态托管直接可用）

---

## 上传前想改的话

| 想改 | 改哪 |
|---|---|
| 项目名 / 简介 | `README.md` 第一段、`package.json` 的 `name` |
| 作者与年份 | `LICENSE` 的 Copyright 行 |
| 数据 | `data/*.json`（改完记得 `pnpm dev` 看一眼） |
| 骨架比例 | `src/engine/compose.ts` 的 `TEMPLATES` |
| 交互规则 | `src/engine/rules.ts` |