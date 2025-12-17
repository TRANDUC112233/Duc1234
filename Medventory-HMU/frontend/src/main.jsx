// File: main.jsx (Đã sửa để hiển thị IssuePage từ thư mục components)

import React from "react";
import ReactDOM from "react-dom/client";
// 1. Sửa import và đường dẫn: Import IssuePage từ thư mục components
import IssuePage from "./components/IssuePage.jsx"; 
import "./index.css"; 
import { Toaster } from "react-hot-toast"; 

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Toaster để hiển thị toast toàn app */}
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#333",
          color: "#fff",
          borderRadius: "8px",
          padding: "10px 16px",
        },
        success: {
          iconTheme: {
            primary: "#4ade80",
            secondary: "#fff",
          },
        },
      }}
    />
    {/* 2. Render component IssuePage */}
    <IssuePage /> 
  </React.StrictMode>
);
