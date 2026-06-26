import React, { useState, useEffect } from "react";

export function DialogRenderer({ dialog, close }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (dialog.type === "prompt") {
      setValue(dialog.message ?? "");
    }
  }, [dialog]);

  if (!dialog.open) return null;

  const handleConfirm = (result) => {
    dialog.resolve?.(result);
    close();
  };

  const handlePrompt = (result) => {
    dialog.resolve?.(result);
    close();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
        overflow: "auto"
      }}
    >
      <div
        className="dialogBox"
        style={{
          minWidth: "320px",
          maxWidth: "500px",
        }}
      >
        <h2 className="dialogTitle">{dialog.title}</h2>
        {dialog.type === "confirm" && (
        <div className="dialogMessage">
          {dialog.message}
        </div>)}

        {dialog.type === "prompt" && (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="dialogInput"
            onKeyDown={(e) => {
    if (e.key === "Enter") {
      handlePrompt(value)
    }
  }}
          />
        )}

        <div className="dialogActions">

          {dialog.type === "confirm" && (
            <>
              <button className="genericBtn" onClick={() => handleConfirm(false)} autoFocus>
                Cancel
              </button>
              <button className="genericBtn" onClick={() => handleConfirm(true)}>
                OK
              </button>
            </>
          )}

          {dialog.type === "prompt" && (
            <>
              <button className="genericBtn" onClick={() => handlePrompt(null)}>
                Cancel
              </button>
              <button className="genericBtn" onClick={() => handlePrompt(value)}>
                OK
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
