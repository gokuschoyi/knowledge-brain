from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [("documents", "0001_initial"), ("knowledge", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="SelfHealingTask",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("task_type", models.CharField(max_length=100)),
                ("status", models.CharField(default="pending", max_length=50)),
                ("priority", models.IntegerField(default=1)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField()),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("result", models.JSONField(blank=True, default=dict)),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("related_chunk", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="documents.chunk")),
                ("related_document", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="documents.document")),
                ("related_entity", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="knowledge.entity")),
            ],
            options={"ordering": ["status", "-priority", "-created_at"]},
        ),
    ]

