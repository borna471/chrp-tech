from PIL import Image
from transformers import pipeline

# Load the zero-shot image classification pipeline using a top Google model
classifier = pipeline(
    "image-text-to-text", model="Qwen/Qwen3-VL-4B-Instruct"
)

# Load your home inspection photo
image = Image.open("public/rusty-pipes-test.jpg")

# Define the insurance risk labels you want to test
labels = ["leaking pipe", "rusty plumbing", "normal clean pipe", "water damage"]

# Run the model
predictions = classifier(image, candidate_labels=labels)

# Print the results
print("Inspection Results:")
for pred in predictions:
    print(f"{pred['label']}: {round(pred['score'] * 100, 2)}%")
