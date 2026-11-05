import React, { useState } from "react";
import { Eye, Layers, Sliders, Info, ZoomIn } from "lucide-react";

export default function GradCamViewer({
  fundusUrl,
  gradcamUrl,
  severityLevel,
  prediction,
  confidence
}) {
  const [viewMode, setViewMode] = useState("side-by-side"); // "side-by-side" or "overlay"
  const [overlayOpacity, setOverlayOpacity] = useState(65);
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="gradcam-viewer-container">
      {/* TOOLBAR */}
      <div className="viewer-toolbar">
        <div className="view-mode-buttons">
          <button
            type="button"
            className={`btn-mode ${viewMode === "side-by-side" ? "active" : ""}`}
            onClick={() => setViewMode("side-by-side")}
          >
            <Layers size={14} /> Side-by-Side
          </button>
          <button
            type="button"
            className={`btn-mode ${viewMode === "overlay" ? "active" : ""}`}
            onClick={() => setViewMode("overlay")}
          >
            <Sliders size={14} /> Overlay Slider
          </button>
        </div>

        {viewMode === "overlay" && (
          <div className="opacity-slider-wrapper">
            <span className="slider-label">Heatmap Blend: {overlayOpacity}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="opacity-slider"
            />
          </div>
        )}

        <button
          type="button"
          className="btn-info-toggle"
          onClick={() => setShowExplanation(!showExplanation)}
        >
          <Info size={14} /> {showExplanation ? "Hide Info" : "How Grad-CAM Works"}
        </button>
      </div>

      {/* EXPLANATION ACCORDION */}
      {showExplanation && (
        <div className="gradcam-explanation-box">
          <h4>
            <Info size={16} /> Explainable AI (Grad-CAM) Visual Analysis
          </h4>
          <p>
            <strong>Gradient-weighted Class Activation Mapping (Grad-CAM)</strong> calculates which regions of the retinal fundus image contributed most heavily to the <strong>{prediction} (Level {severityLevel})</strong> decision:
          </p>
          <div className="color-key-row">
            <div className="key-item">
              <span className="color-swatch swatch-red"></span>
              <span><strong>Red / Crimson:</strong> Peak activation zones (critical lesion clusters, hemorrhages, neovascularization)</span>
            </div>
            <div className="key-item">
              <span className="color-swatch swatch-yellow"></span>
              <span><strong>Yellow / Green:</strong> Moderate activation zones (exudates, early microaneurysms, vessel changes)</span>
            </div>
            <div className="key-item">
              <span className="color-swatch swatch-blue"></span>
              <span><strong>Blue / Purple:</strong> Low / Baseline activation (healthy, non-affected retinal background)</span>
            </div>
          </div>
        </div>
      )}

      {/* DISPLAY CANVAS */}
      <div className="viewer-canvas">
        {viewMode === "side-by-side" ? (
          <div className="side-by-side-grid">
            <div className="image-panel">
              <div className="panel-label">Raw Retinal Fundus</div>
              <div className="img-frame">
                {fundusUrl ? (
                  <img src={fundusUrl} alt="Raw Retinal Fundus" className="viewer-img" />
                ) : (
                  <div className="empty-img-placeholder">Fundus Image Unavailable</div>
                )}
              </div>
              <div className="panel-footer-note">Input camera scan</div>
            </div>

            <div className="image-panel">
              <div className="panel-label">Grad-CAM Lesion Activation Heatmap</div>
              <div className="img-frame">
                {gradcamUrl ? (
                  <img src={gradcamUrl} alt="Grad-CAM Heatmap" className="viewer-img" />
                ) : (
                  <div className="empty-img-placeholder">Grad-CAM Unavailable</div>
                )}
              </div>
              <div className="panel-footer-note">Attention overlay (EfficientNet-B0)</div>
            </div>
          </div>
        ) : (
          <div className="overlay-container">
            <div className="overlay-image-stack">
              {fundusUrl && (
                <img
                  src={fundusUrl}
                  alt="Base Fundus"
                  className="base-fundus-layer"
                />
              )}
              {gradcamUrl && (
                <img
                  src={gradcamUrl}
                  alt="Grad-CAM Layer"
                  className="gradcam-overlay-layer"
                  style={{ opacity: overlayOpacity / 100 }}
                />
              )}
            </div>
            <div className="overlay-caption">
              Drag the slider above to toggle between raw retinal anatomy and highlighted lesion regions.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
