import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import MarkdownEditor from "./components/MarkdownEditor";
import "./App.css";
import { DialogProvider, useDialog } from "./dialog/DialogProvider";

const API_URL = `/api`;
const BASE_PATH = "/storage";

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [tree, setTree] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [content, setContent] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dialog = useDialog();

  const videoExt = ["mp4", "webm", "mov", "avi", "mkv"];
  const audioExt = ["mp3", "wav", "ogg", "flac", "aac", "m4a"];
  const imageExt = ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"];

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    path: null,
    name: null,
    kind: null,
  });

  const [uploadTarget, setUploadTarget] = useState(null);

  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  const getFileType = (name) => {
    if (!name) return "unknown";
    const ext = name.split(".").pop().toLowerCase();

    if (ext === "md") return "markdown";
    if (audioExt.includes(ext)) return "audio";
    if (imageExt.includes(ext)) return "image";
    if (videoExt.includes(ext)) return "video";

    return "unknown";
  };

  const getFileIcon = (name, isFolder, isPreview) => {
    if (isFolder && isPreview) return "🌐";
    if (isFolder) return "📁";
    const ext = name.split(".").pop().toLowerCase();
    if (ext === "md") return "📄";
    if (imageExt.includes(ext)) return "🖼️";
    if (videoExt.includes(ext)) return "🎥";
    if (audioExt.includes(ext)) return "🎵";
    return "❓";
  };

  const isPreviewFolder = (node) => node && node.isFolder && node.path === "public";

  const loadPath = async (nodePath) => {
    if (!nodePath) {
      setActiveNode(null);
      setContent("");
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await axios.get(`${API_URL}/node`, {
        params: { path: nodePath },
      });

      const node = res.data;
      setActiveNode(node);

      if (!node.isFolder && getFileType(node.name) === "markdown") {
        setContent(node.content ?? "");
      } else {
        setContent("");
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Resource not found" });
      setActiveNode(null);
      setContent("");
      navigate(BASE_PATH, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
    return () => {};
  }, []);

  useEffect(() => {
    let relativePath = location.pathname.replace(BASE_PATH, "");
    relativePath = relativePath.replace(/^\/+/, "").replace(/\/+$/, "");

    if (!relativePath) {
      loadPath(null);
    } else {
      loadPath(relativePath);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!activeNode || !activeNode.path) return;
    if (getFileType(activeNode.name) !== "markdown") return;
    if (!isDirty) return;

    const timer = setTimeout(async () => {
      try {
        await axios.post(`${API_URL}/file`, {
          path: activeNode.path,
          content: content,
        });
        setIsDirty(false);
      } catch (error) {
        console.error("❌ Auto-save failed:", error);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [activeNode, isDirty, content]);

  const handleAutoSave = async () => {
    if (!activeNode || !activeNode.path || getFileType(activeNode.name) !== "markdown") return;
    try {
      await axios.post(`${API_URL}/file`, { path: activeNode.path, content });
      setIsDirty(false);
    } catch (error) {
      console.error("Manual save failed:", error);
    }
  };

  const handleCopyLink = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ type: "success", text: "Link copied!" });
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand("copy");
        setMessage({ type: "success", text: "Link copied!" });
      } catch (copyErr) {
        setMessage({ type: "error", text: "Could not copy link" });
      }
      document.body.removeChild(textArea);
    }
  };

  const fetchTree = async () => {
    try {
      const res = await axios.get(`${API_URL}/tree`);
      console.log("TREE RESPONSE", res.data);
      setTree(res.data);
    } catch (e) {
      console.error("TREE ERROR", e);
      setMessage({ type: "error", text: "Failed to load file tree." });
    }
  };

  const collectFolderPaths = (node, paths = []) => {
    if (!node) return paths;
    if (node.isFolder && node.path) paths.push(node.path);
    const folders = node.children?.folders || [];
    folders.forEach((folder) => collectFolderPaths(folder, paths));
    return paths;
  };

  const expandAll = () => {
    if (!tree) return;
    const paths = collectFolderPaths(tree);
    setExpandedNodes(new Set(paths));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const expandPathRecursive = (filePath) => {
    if (!filePath) return;
    const segments = filePath.split("/").filter((s) => s);
    const pathsToExpand = new Set();
    segments.forEach((_, index) => {
      const fullSegmentPath = segments.slice(0, index + 1).join("/");
      pathsToExpand.add(fullSegmentPath);
    });
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      pathsToExpand.forEach((p) => next.add(p));
      return next;
    });
  };

  const toggleExpand = (path) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const getMediaUrl = (filePath) => {
    return `${API_URL}/media?path=${encodeURIComponent(filePath)}`;
  };

  // --- Upload Handlers (Refactored) ---

  const uploadFile = async (file) => {
    if (!file) return;

    const targetPath = uploadTarget || (activeNode?.isFolder ? activeNode.path : "");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", targetPath);

    try {
      setLoading(true);

      await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage({
        type: "success",
        text: `Uploaded ${file.name}`,
      });

      fetchTree();
    } catch (err) {
      console.error(err);
      setMessage({
        type: "error",
        text: `Upload failed: ${file.name}`,
      });
    } finally {
      setLoading(false);
      setUploadTarget(null);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    await uploadFile(file);
    event.target.value = "";
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(false);

    const files = [...e.dataTransfer.files];

    for (const file of files) {
      await uploadFile(file);
    }
  };

  const triggerUpload = () => {
    if (!activeNode || !activeNode.isFolder) return;

    setUploadTarget(activeNode.path);
    fileInputRef.current?.click();
  };

  const triggerCreateFile = async (parentPath = null) => {
    const name = await dialog.prompt("Enter filename:", "todo.md");
    if (!name) return;
    createFileInternal(name, parentPath);
  };

  const triggerCreateFolder = async (parentPath = null) => {
    const name = await dialog.prompt("Enter folder name:", "folderName");
    if (!name) return;
    createFolderInternal(name, parentPath);
  };

  const createFileInternal = (name, parentPath = null) => {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    setLoading(true);
    axios
    .post(`${API_URL}/file`, { path: fullPath, content: "" })
    .then((res) => {
      setMessage({ type: "success", text: `Created: ${fullPath}` });
      fetchTree();
      navigate(`${BASE_PATH}/${fullPath}`);
    })
    .catch((error) => {
      setMessage({ type: "error", text: error.response?.data?.error || "Failed to create file" });
    })
    .finally(() => setLoading(false));
  };

  const createFolderInternal = (name, parentPath = null) => {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    setLoading(true);
    axios
    .post(`${API_URL}/create-folder`, { path: fullPath })
    .then(() => {
      setMessage({ type: "success", text: `Created Folder: ${fullPath}` });
      fetchTree();
      navigate(`${BASE_PATH}/${fullPath}/`);
    })
    .catch((error) => {
      setMessage({ type: "error", text: error.response?.data?.error || "Failed to create folder" });
    })
    .finally(() => setLoading(false));
  };

  const deleteItem = async (path, name) => {
    const confirmed = await dialog.confirm(`Delete "${name}"?`, "This action cannot be undone.");

    if (!confirmed) return;

    setLoading(true);
    axios
    .delete(`${API_URL}/item`, { params: { path } })
    .then(() => {
      setMessage({ type: "success", text: "Item deleted" });
      fetchTree();
      if (activeNode?.path === path) {
        navigate(BASE_PATH);
      }
    })
    .catch((error) => {
      setMessage({ type: "error", text: error.response?.data?.error || "Failed to delete" });
    })
    .finally(() => setLoading(false));
  };

  const renameItem = async (path, oldName, isFolder) => {
    const newName = await dialog.prompt(isFolder ? "Enter name:" : "Enter filename:", oldName);
    if (!newName || newName === oldName) return;

    setLoading(true);
    axios
    .put(`${API_URL}/rename`, { path, newName })
    .then((res) => {
      setMessage({ type: "success", text: `${isFolder ? "Folder" : "File"} renamed to: ${newName}` });
      fetchTree();
      navigate(res.data.path);
    })
    .catch((error) => {
      setMessage({ type: "error", text: error.response?.data?.error || "Rename failed" });
    })
    .finally(() => setLoading(false));
  };

  const getItemKind = (path, isFolder) => {
    if (path === "") return "root";
    if (isFolder) return "folder";
    return "file";
  };

  const getMenuOptions = (kind) => {
    const buttons = [];
    if (kind === "root" || kind === "folder") {
      buttons.push({ label: "New File", onClick: () => triggerCreateFile(contextMenu.path) });
      buttons.push({ label: "New Folder", onClick: () => triggerCreateFolder(contextMenu.path) });
      buttons.push({
        label: "Upload File",
        onClick: () => {
          setUploadTarget(contextMenu.path);
          fileInputRef.current?.click();
        },
      });
    }
    if (kind === "folder" || kind === "file") {
      buttons.push({ label: "Rename", onClick: () => renameItem(contextMenu.path, contextMenu.name, kind === "folder") });
      buttons.push({ label: "Delete", onClick: () => deleteItem(contextMenu.path, contextMenu.name), className: "dangerBtn" });
    }
    return buttons;
  };

  const showContextMenu = (e, path, name, isFolder) => {
    e.preventDefault();
    e.stopPropagation();
    let x = e.clientX;
    let y = e.clientY;
    if (x + 200 > window.innerWidth) x -= 200;
    if (y + 150 > window.innerHeight) y -= 150;

    const kind = getItemKind(path, isFolder);
    setContextMenu({ visible: true, x, y, path, name, kind });
  };

  const handleGlobalClick = (e) => setContextMenu((prev) => ({ ...prev, visible: false }));
  const handleCloseMenu = () => setContextMenu((prev) => ({ ...prev, visible: false }));
  const handleKeyDown = (e) => {
    if (e.key === "Escape") handleCloseMenu();
  };

    useEffect(() => {
      document.addEventListener("click", handleGlobalClick);
      document.addEventListener("scroll", handleGlobalClick);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("click", handleGlobalClick);
        document.removeEventListener("scroll", handleGlobalClick);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, []);

    const rootChildren = useMemo(() => {
      if (!tree) return [];
      return [...(tree.children?.folders || []), ...(tree.children?.files || [])];
    }, [tree]);

    const renderTree = (node) => {
      if (!node) return null;
      const key = node.path || `unknown-${node.name}-${Math.random()}`;
      const isExpanded = !!(node.path && expandedNodes.has(node.path));
      const isFolder = node.isFolder;
      const isPreview = node.path === "public";
      const hasChildren = (node.children?.folders?.length || 0) > 0 || (node.children?.files?.length || 0) > 0;

      return (
        <div className="treeItem" key={key} onContextMenu={(e) => showContextMenu(e, node.path, node.name, isFolder)}>
        <div
        onClick={() => {
          navigate(node.isFolder ? `${BASE_PATH}/${node.path}/` : `${BASE_PATH}/${node.path}`);
        }}
        className="treeBtn"
        >
        <span className="treeIcon">{getFileIcon(node.name, isFolder, isPreview)}</span>
        <span className="treeName">{node.name}</span>
        {isFolder && hasChildren && (
          <span
          className="expandToggle"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand(node.path);
          }}
          style={{ fontSize: "13px", cursor: "pointer" }}
          >
          {isExpanded ? "⇊" : "⇀"}
          </span>
        )}
        </div>
        {isFolder && isExpanded && (
          <div className="treeSub">
          {(node.children?.folders || []).map((folder) => renderTree(folder))}
          {(node.children?.files || []).map((file) => (
            <div
            key={file.path || `file-${file.name}-${Math.random()}`}
            onClick={() => navigate(`${BASE_PATH}/${file.path}`)}
            onContextMenu={(e) => showContextMenu(e, file.path, file.name, false)}
            className="treeBtn"
            >
            <span className="treeIcon">{getFileIcon(file.name, false, false)}</span>
            <span className="treeName">{file.name}</span>
            </div>
          ))}
          </div>
        )}
        </div>
      );
    };

    const showUploadButton = (node) => {
      if (!node || !node.isFolder || node.path === "public") return false;
      if (loading) return false;
      return true;
    };

    return (
      <div className="container" ref={menuRef}>
      <h1 className="headerTitle">HugoCMS</h1>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="mainLayout">
      <div className="sidebar">
      <div style={{ display: "flex", gap: "8px", padding: "8px", flexWrap: "wrap", borderBottom: "1px solid #f0f0f0", marginBottom: "8px" }}>
      <button className="genericBtn" onClick={expandAll}>
      Expand All
      </button>
      <button className="genericBtn" onClick={collapseAll}>
      Collapse All
      </button>
      </div>

      <div
      style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget) {
          showContextMenu(e, "", "root", true);
        }
      }}
      >
      {!tree ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>Loading...</div>
      ) : rootChildren.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>Empty Directory</div>
      ) : (
        rootChildren.map((node) => renderTree(node))
      )}
      </div>
      </div>

      <div className="editorContainer">
      {!activeNode ? (
        <div className="emptyState">
        <span style={{ fontSize: "3rem" }}>📂</span>
        <p>Select a file or create a new one via the context menu</p>
        </div>
      ) : (
        <>
        <div className="editorArea">
        {loading ? (
          <></>
        ) : isPreviewFolder(activeNode) ? (
          <>
          <div className="mediaContainer">
          <button onClick={() => (window.location.href = "/preview")} href="/preview" className="genericBtn">
          Show preview
          </button>
          </div>
          <div className="mediaContainer">
          <button
          onClick={async () => {
            const confirmed = await dialog.confirm("Deploy site?", "This will publish your site and make changes live.");
            if (!confirmed) return;

            try {
              setLoading(true);
              await axios.post(`${API_URL}/deploy`);
              setMessage({ type: "success", text: "Site deployed successfully!" });
            } catch (err) {
              setMessage({ type: "error", text: err.response?.data?.error || "Deployment failed." });
            } finally {
              setLoading(false);
            }
          }}
          className="genericBtn"
          >
          Deploy site
          </button>
          </div>
          </>
        ) : activeNode.isFolder ? (
          <></>
        ) : getFileType(activeNode.name) === "markdown" ? (
          <MarkdownEditor content={content} setContent={setContent} setDirty={setIsDirty} />
        ) : getFileType(activeNode.name) === "audio" ? (
          <div className="mediaContainer">
          <audio controls src={getMediaUrl(activeNode.path)} style={{ width: "100%" }} />
          <button onClick={() => handleCopyLink(getMediaUrl(activeNode.path))} className="genericBtn">
          Copy direct link
          </button>
          </div>
        ) : getFileType(activeNode.name) === "image" ? (
          <div className="mediaContainer">
          <img
          src={getMediaUrl(activeNode.path)}
          alt={activeNode.name}
          className="mediaPreviewImage"
          onError={(e) => (e.target.style.display = "none")}
          />
          <button onClick={() => handleCopyLink(getMediaUrl(activeNode.path))} className="genericBtn">
          Copy direct link
          </button>
          </div>
        ) : getFileType(activeNode.name) === "video" ? (
          <div className="mediaContainer">
          <video
          controls
          src={getMediaUrl(activeNode.path)}
          className="mediaPreviewVideo"
          onError={(e) => (e.target.style.display = "none")}
          />
          <button onClick={() => handleCopyLink(getMediaUrl(activeNode.path))} className="genericBtn">
          Copy direct link
          </button>
          </div>
        ) : (
          <div className="unknownType">
          <p>Unknown file type or media cannot be previewed.</p>
          </div>
        )}

        {showUploadButton(activeNode) && (
          <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            marginTop: "20px",
            gap: "12px",
          }}
          >
          <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1,
            minHeight: "250px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            opacity: isDragging ? 1 : 0.8,
            transition: "all 0.15s ease",
            backgroundColor: isDragging ? "rgba(76,175,80,0.1)" : "transparent",
          }}
          >
          📤 Drag files here to upload
          </div>
          </div>
        )}
        </div>
        </>
      )}
      </div>
      </div>

      <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleUpload} />

      <div className={`contextMenu ${contextMenu.visible ? "visible" : ""}`} style={{ left: contextMenu.x, top: contextMenu.y }}>
      {getMenuOptions(contextMenu.kind).map((btn, idx) => (
        <button
        key={idx}
        onClick={(e) => {
          btn.onClick();
          handleCloseMenu();
        }}
        className={btn.className || ""}
        >
        {btn.label}
        </button>
      ))}
      </div>
      </div>
    );
}

export default App;
