import os

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms


# --------------------------------------------------
# Model path
# --------------------------------------------------

MODEL_PATH = os.path.join(
    os.path.dirname(
        os.path.dirname(
            os.path.dirname(__file__)
        )
    ),
    "model",
    "efficientnet_b0.pth"
)


# --------------------------------------------------
# Class names
# --------------------------------------------------

CLASS_NAMES = {
    0: "No Diabetic Retinopathy",
    1: "Mild Diabetic Retinopathy",
    2: "Moderate Diabetic Retinopathy",
    3: "Severe Diabetic Retinopathy",
    4: "Proliferative Diabetic Retinopathy"
}


# --------------------------------------------------
# Device
# --------------------------------------------------

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# --------------------------------------------------
# Image preprocessing
# --------------------------------------------------

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# --------------------------------------------------
# Create EfficientNet-B0
# --------------------------------------------------

model = models.efficientnet_b0(
    weights=None
)

model.classifier[1] = nn.Linear(
    model.classifier[1].in_features,
    5
)


# --------------------------------------------------
# Load trained weights
# --------------------------------------------------

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"Model file not found at: {MODEL_PATH}"
    )


checkpoint = torch.load(
    MODEL_PATH,
    map_location=device
)


# Handle checkpoint dictionaries
if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
    checkpoint = checkpoint["state_dict"]


model.load_state_dict(checkpoint)

model.to(device)

model.eval()


# --------------------------------------------------
# Prediction function
# --------------------------------------------------

def predict_image(image: Image.Image):

    image = image.convert("RGB")

    input_tensor = transform(image)

    input_tensor = input_tensor.unsqueeze(0)

    input_tensor = input_tensor.to(device)

    with torch.no_grad():

        outputs = model(input_tensor)

        probabilities = torch.softmax(
            outputs,
            dim=1
        )

        confidence, predicted_class = torch.max(
            probabilities,
            dim=1
        )

    class_index = predicted_class.item()

    confidence_value = confidence.item()

    return {
        "class_index": class_index,
        "prediction": CLASS_NAMES[class_index],
        "confidence": round(
            confidence_value * 100,
            2
        )
    }