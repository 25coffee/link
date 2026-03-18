# 寻找创业合伙人（GitHub Pages 静态站）

这是一个可直接用于 `github.io` 的静态页面：

- 页面标题：**寻找创业合伙人**
- 右上角按钮：**填写信息**（跳转到腾讯表单）
- 页面展示：竖向卡片列表（**标题 / 内容 / 昵称 / 联系方式**）
- 数据来源：`data/submissions.json`

> 说明：GitHub Pages 是纯静态站，**无法直接从腾讯表单“实时拉取回收数据”**（除非你有腾讯表单的公开 API / 或你自己做同步服务）。本仓库提供“先可用”的方案：**从腾讯表单导出 CSV → 转成 JSON → 提交到仓库**，页面就会自动更新。

---

## 1) 配置腾讯表单链接

打开 `assets/main.js`，把 `CONFIG.FORM_URL` 改成你的腾讯表单分享链接：

- 文件：`assets/main.js`
- 字段：`CONFIG.FORM_URL`

---

## 2) 数据格式（页面展示用）

页面读取 `data/submissions.json`，格式如下：

```json
{
  "updatedAt": "2026-03-18T00:00:00.000Z",
  "items": [
    {
      "title": "标题",
      "content": "内容",
      "nickname": "昵称",
      "contact": "联系方式",
      "createdAt": "2026-03-18T00:00:00.000Z"
    }
  ]
}
```

- `items`：数组；每一项渲染成一个卡片
- `createdAt`：可选；用于按时间倒序排序
- `updatedAt`：可选；用于右上角显示“更新于…”

---

## 3) 如何从腾讯表单导出并更新到页面

### A. 在腾讯表单里导出回收数据（CSV）

在腾讯表单后台找到 **导出/下载** 功能，导出为 CSV 文件（具体入口可能随产品迭代有变化）。

然后把 CSV 放到本仓库任意位置（建议：`./exports/latest.csv`，此目录你也可以自己建）。

### B. 把 CSV 转成 `data/submissions.json`

仓库内置一个转换脚本（纯标准库，无需安装依赖）：

```bash
python3 tools/convert_csv_to_submissions_json.py \
  --input ./exports/latest.csv \
  --output ./data/submissions.json
```

脚本会根据 CSV 表头，自动识别以下字段（不区分大小写，支持中英文别名）：

- 标题：`title` / `标题`
- 内容：`content` / `内容` / `描述`
- 昵称：`nickname` / `昵称`
- 联系方式：`contact` / `联系方式` / `微信` / `手机号` / `邮箱`
- 提交时间（可选）：`createdAt` / `提交时间` / `时间`

最后把更新后的 `data/submissions.json` 提交到仓库即可，GitHub Pages 会自动更新展示。

---

## 4) 部署到 GitHub Pages（github.io）

两种常见方式：

### A. 你的仓库名是 `用户名.github.io`

把这些文件直接推到该仓库的默认分支（通常是 `main`），访问：

- `https://用户名.github.io`

### B. 你的仓库名是普通仓库（例如 `partner`）

在 GitHub 仓库设置里：

- Settings → Pages
- Source 选择：Deploy from a branch
- Branch 选择：`main` / `/ (root)`

访问：

- `https://用户名.github.io/仓库名/`

---

## 5) 可选：把“导出→转 JSON”自动化

如果你能拿到腾讯表单的“导出下载链接”或“开放 API”，可以用 GitHub Actions 定时拉取 CSV/JSON，再运行本脚本更新 `data/submissions.json`。

由于不同腾讯表单/权限/组织配置差异很大，本仓库先不强绑定具体接口。你把：

- 你的腾讯表单导出方式（链接/API 说明）
- 导出的 CSV 表头示例

发我，我可以继续把 Actions 工作流补齐到“全自动同步”。

