FROM python:3.11-slim

WORKDIR /app

# Ensure we have a non-root user for security (best practice)
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install minimal dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the app code
COPY app /app/app

# Change ownership
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
