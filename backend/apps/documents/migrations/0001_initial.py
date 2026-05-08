from django.db import migrations, models
import django.db.models.deletion
import pgvector.django.vector


class Migration(migrations.Migration):
    initial = True

    dependencies = [("core", "0000_enable_pgvector")]

    operations = [
        migrations.CreateModel(
            name="Document",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("source_type", models.CharField(choices=[("text", "Text"), ("file", "File"), ("url", "URL")], max_length=50)),
                ("raw_text", models.TextField(blank=True)),
                ("raw_file", models.FileField(blank=True, null=True, upload_to="documents/")),
                ("url", models.URLField(blank=True)),
                ("tags", models.JSONField(blank=True, default=list)),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("processing", "Processing"), ("completed", "Completed"), ("failed", "Failed")],
                        default="pending",
                        max_length=50,
                    ),
                ),
                ("summary", models.TextField(blank=True)),
                ("quality_score", models.FloatField(default=0)),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="IngestionJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(default="pending", max_length=50)),
                ("current_step", models.CharField(blank=True, max_length=100)),
                ("progress", models.IntegerField(default=0)),
                ("log", models.JSONField(blank=True, default=list)),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "document",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ingestion_jobs", to="documents.document"),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Chunk",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField()),
                ("summary", models.TextField(blank=True)),
                ("chunk_index", models.IntegerField()),
                ("token_count", models.IntegerField(default=0)),
                ("embedding", pgvector.django.vector.VectorField(blank=True, dimensions=1536, null=True)),
                ("importance_score", models.FloatField(default=0)),
                ("quality_score", models.FloatField(default=0)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "document",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="chunks", to="documents.document"),
                ),
            ],
            options={"ordering": ["document_id", "chunk_index"], "unique_together": {("document", "chunk_index")}},
        ),
    ]

