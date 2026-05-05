from django.db import migrations, models
import django.db.models.deletion
import pgvector.django.vector


class Migration(migrations.Migration):
    initial = True

    dependencies = [("documents", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="Entity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("canonical_name", models.CharField(blank=True, max_length=255)),
                ("entity_type", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True)),
                ("confidence", models.FloatField(default=0)),
                ("embedding", pgvector.django.vector.VectorField(blank=True, dimensions=1536, null=True)),
                ("aliases", models.JSONField(blank=True, default=list)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="ChatSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="ChunkEntityMention",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("mention_text", models.CharField(max_length=255)),
                ("confidence", models.FloatField(default=0)),
                ("chunk", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entity_mentions", to="documents.chunk")),
                ("entity", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="mentions", to="knowledge.entity")),
            ],
        ),
        migrations.CreateModel(
            name="Claim",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField()),
                ("confidence", models.FloatField(default=0)),
                ("verified_status", models.CharField(default="unverified", max_length=50)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("source_chunk", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="claims", to="documents.chunk")),
                ("subject_entity", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="claims", to="knowledge.entity")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Relationship",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("relationship_type", models.CharField(max_length=100)),
                ("confidence", models.FloatField(default=0)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("evidence_chunk", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="relationships", to="documents.chunk")),
                ("source_entity", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="outgoing_relationships", to="knowledge.entity")),
                ("target_entity", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="incoming_relationships", to="knowledge.entity")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="ChatMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(max_length=50)),
                ("content", models.TextField()),
                ("confidence_score", models.FloatField(blank=True, null=True)),
                ("sources", models.JSONField(blank=True, default=list)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("session", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="knowledge.chatsession")),
            ],
            options={"ordering": ["created_at"]},
        ),
        migrations.AddIndex(model_name="entity", index=models.Index(fields=["name"], name="knowledge_e_name_b74efc_idx")),
        migrations.AddIndex(model_name="relationship", index=models.Index(fields=["relationship_type"], name="knowledge_r_relatio_2db149_idx")),
    ]

