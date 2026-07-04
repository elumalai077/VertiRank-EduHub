import React from "react";
import { Outlet } from "react-router-dom";
import BatchSidebar from "./BatchSidebar";
export default function BatchLayout() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      {/* Sidebar */}
      <BatchSidebar />

      {/* Content Area */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "20px",
        }}
      >
        <Outlet />
      </div>
    </div>
  );
}