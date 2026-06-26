import { useState, useEffect } from "react";
import Editor from "@uiw/react-md-editor";

export default function MarkdownEditor({ content, setContent, setDirty }) {
  const [internalContent, setInternalContent] = useState(content);

  useEffect(() => setInternalContent(content), [content]);

  const handleChange = (newValue) => {
    setInternalContent(newValue);
    setContent(newValue);
    if (setDirty) setDirty(true);
  };

    return (
      <div style={{ padding: "2rem" }}>
      <Editor value={internalContent} onChange={handleChange} height="750px" maxHeight="750" minHeight="750" />
      </div>
    );
}
