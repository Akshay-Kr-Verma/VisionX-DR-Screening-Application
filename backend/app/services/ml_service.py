import os
import uuid
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

# --------------------------------------------------
# Directories
# --------------------------------------------------

BACKEND_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(__file__)
    )
)

MODEL_PATH = os.path.join(
    BACKEND_DIR,
    "model",
    "efficientnet_b0.pth"
)

UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
FUNDUS_DIR = os.path.join(UPLOAD_DIR, "fundus")
GRADCAM_DIR = os.path.join(UPLOAD_DIR, "gradcam")

os.makedirs(FUNDUS_DIR, exist_ok=True)
os.makedirs(GRADCAM_DIR, exist_ok=True)

# --------------------------------------------------
# Class names & Priority Guidelines
# --------------------------------------------------

CLASS_NAMES = {
    0: "No Diabetic Retinopathy",
    1: "Mild Diabetic Retinopathy",
    2: "Moderate Diabetic Retinopathy",
    3: "Severe Diabetic Retinopathy",
    4: "Proliferative Diabetic Retinopathy"
}

DR_LEVELS = CLASS_NAMES

PRIORITY_MAP = {
    4: "URGENT",
    3: "HIGH",
    2: "MEDIUM",
    1: "ROUTINE",
    0: "ROUTINE"
}

CLINICAL_RECOMMENDATIONS = {
    4: {
        "priority": "URGENT",
        "action": "Immediate Vitreoretinal Specialist Referral",
        "suggested_treatment": "Panretinal Photocoagulation (PRP) / Anti-VEGF / Vitrectomy Evaluation",
        "suggested_medication": "Intravitreal Anti-VEGF (Aflibercept/Ranibizumab); Strict BP and HbA1c control",
        "follow_up": "Immediate / Within 24-48 hours"
    },
    3: {
        "priority": "HIGH",
        "action": "Urgent Retinal Clinic Review",
        "suggested_treatment": "Comprehensive macula evaluation (OCT); Consider early panretinal laser",
        "suggested_medication": "Optimize glycemic control (HbA1c < 7.0%); Fenofibrate 145mg daily; ACE inhibitor / ARB",
        "follow_up": "Within 1-2 weeks"
    },
    2: {
        "priority": "MEDIUM",
        "action": "Ophthalmology Examination & Macula Evaluation",
        "suggested_treatment": "Spectral-domain OCT to evaluate Diabetic Macular Edema (DME)",
        "suggested_medication": "Intensive glycemic, blood pressure and lipid optimization",
        "follow_up": "Within 1-2 months"
    },
    1: {
        "priority": "ROUTINE",
        "action": "Preventive Retinopathy Management",
        "suggested_treatment": "Digital retinal photography repeat in 6-12 months",
        "suggested_medication": "Routine antidiabetic regimen; annual lipid and microalbuminuria screening",
        "follow_up": "Within 6-12 months"
    },
    0: {
        "priority": "ROUTINE",
        "action": "Annual Routine Screening",
        "suggested_treatment": "Annual preventive fundus screening",
        "suggested_medication": "Maintain standard diabetes management regimen",
        "follow_up": "12 months"
    }
}

# --------------------------------------------------
# Device & Transforms
# --------------------------------------------------

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# --------------------------------------------------
# Create EfficientNet-B0 Model
# --------------------------------------------------

model = models.efficientnet_b0(weights=None)
model.classifier[1] = nn.Linear(
    model.classifier[1].in_features,
    5
)

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"Model file not found at: {MODEL_PATH}"
    )

checkpoint = torch.load(
    MODEL_PATH,
    map_location=device
)

if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
    checkpoint = checkpoint["state_dict"]

model.load_state_dict(checkpoint)
model.to(device)
model.eval()

# --------------------------------------------------
# Colormap Helper (JET pure numpy)
# --------------------------------------------------

def apply_jet_colormap(heatmap: np.ndarray) -> np.ndarray:
    """
    heatmap: 2D numpy array [0.0, 1.0]
    returns: uint8 RGB numpy array (H, W, 3)
    """
    r = np.clip(1.5 - np.abs(4.0 * heatmap - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - np.abs(4.0 * heatmap - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - np.abs(4.0 * heatmap - 1.0), 0.0, 1.0)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)

# --------------------------------------------------
# Prediction function (Legacy / Simple)
# --------------------------------------------------

def predict_image(image: Image.Image):
    image = image.convert("RGB")
    input_tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(input_tensor)
        probabilities = torch.softmax(outputs, dim=1)
        confidence, predicted_class = torch.max(probabilities, dim=1)

    class_index = predicted_class.item()
    confidence_value = round(confidence.item() * 100, 2)

    return {
        "class_index": class_index,
        "prediction": CLASS_NAMES[class_index],
        "confidence": confidence_value
    }

# --------------------------------------------------
# Grad-CAM Inference & Image Overlay
# --------------------------------------------------

def predict_with_gradcam(image: Image.Image, save_files: bool = True):
    """
    Runs classification inference and extracts Grad-CAM heatmaps
    from the final convolutional block of EfficientNet-B0.
    Overlays the activation heatmap onto the retinal fundus image.
    """
    image_rgb = image.convert("RGB")
    orig_w, orig_h = image_rgb.size

    input_tensor = transform(image_rgb).unsqueeze(0).to(device)
    input_tensor.requires_grad = True

    activations = None
    gradients = None

    def forward_hook(module, inp, out):
        nonlocal activations
        activations = out

    def backward_hook(module, grad_in, grad_out):
        nonlocal gradients
        gradients = grad_out[0]

    # Target last convolutional block in EfficientNet-B0
    target_layer = model.features[-1]
    h_fwd = target_layer.register_forward_hook(forward_hook)
    h_bwd = target_layer.register_full_backward_hook(backward_hook)

    model.zero_grad()
    outputs = model(input_tensor)
    probabilities = torch.softmax(outputs, dim=1)

    confidence, predicted_class = torch.max(probabilities, dim=1)
    class_index = predicted_class.item()
    confidence_val = round(confidence.item() * 100, 2)

    # Class score backward pass
    score = outputs[0, class_index]
    score.backward()

    # Remove hooks
    h_fwd.remove()
    h_bwd.remove()

    # Calculate channel importance weights (Global Average Pooling)
    weights = torch.mean(gradients, dim=(2, 3), keepdim=True)

    # Weighted linear combination of feature maps
    cam = torch.sum(weights * activations, dim=1, keepdim=True)
    cam = torch.relu(cam)

    # Resize CAM to original image dimensions
    cam_resized = torch.nn.functional.interpolate(
        cam,
        size=(orig_h, orig_w),
        mode="bilinear",
        align_corners=False
    )
    cam_np = cam_resized.squeeze().detach().cpu().numpy()

    # Min-max normalization
    cam_min, cam_max = cam_np.min(), cam_np.max()
    if cam_max > cam_min:
        cam_norm = (cam_np - cam_min) / (cam_max - cam_min)
    else:
        cam_norm = np.zeros_like(cam_np)

    # Generate colored heatmap
    heatmap_rgb = apply_jet_colormap(cam_norm)

    # Blend original image with heatmap (0.55 original + 0.45 heatmap)
    orig_np = np.array(image_rgb)
    overlay_np = (0.55 * orig_np + 0.45 * heatmap_rgb).astype(np.uint8)

    heatmap_img = Image.fromarray(heatmap_rgb)
    overlay_img = Image.fromarray(overlay_np)

    # Probabilities across all 5 classes
    prob_dist = {}
    probs_np = probabilities.squeeze().detach().cpu().numpy()
    for idx, name in CLASS_NAMES.items():
        prob_dist[name] = round(float(probs_np[idx]) * 100, 2)

    priority = PRIORITY_MAP.get(class_index, "ROUTINE")
    rec = CLINICAL_RECOMMENDATIONS.get(class_index, {})

    fundus_url = None
    gradcam_url = None
    saved_fundus_path = None
    saved_gradcam_path = None

    if save_files:
        uid = uuid.uuid4().hex[:12]
        fundus_filename = f"fundus_{uid}.jpg"
        gradcam_filename = f"gradcam_{uid}.jpg"

        saved_fundus_path = os.path.join(FUNDUS_DIR, fundus_filename)
        saved_gradcam_path = os.path.join(GRADCAM_DIR, gradcam_filename)

        image_rgb.save(saved_fundus_path, "JPEG", quality=92)
        overlay_img.save(saved_gradcam_path, "JPEG", quality=92)

        fundus_url = f"/uploads/fundus/{fundus_filename}"
        gradcam_url = f"/uploads/gradcam/{gradcam_filename}"

    return {
        "class_index": class_index,
        "prediction": CLASS_NAMES[class_index],
        "confidence": confidence_val,
        "severity_level": class_index,
        "priority": priority,
        "clinical_action": rec.get("action", ""),
        "suggested_treatment": rec.get("suggested_treatment", ""),
        "suggested_medication": rec.get("suggested_medication", ""),
        "follow_up": rec.get("follow_up", ""),
        "probability_distribution": prob_dist,
        "image_path": fundus_url,
        "gradcam_path": gradcam_url,
        "saved_fundus_path": saved_fundus_path,
        "saved_gradcam_path": saved_gradcam_path
    }