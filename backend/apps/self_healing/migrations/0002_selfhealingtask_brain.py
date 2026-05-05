from django.db import migrations, models
import django.db.models.deletion


def backfill_task_brains(apps, schema_editor):
    SelfHealingTask = apps.get_model("self_healing", "SelfHealingTask")

    for task in SelfHealingTask.objects.select_related("related_document", "related_entity").all():
        brain_id = None
        if task.related_document_id and task.related_document and task.related_document.brain_id:
            brain_id = task.related_document.brain_id
        elif task.related_entity_id and task.related_entity and task.related_entity.brain_id:
            brain_id = task.related_entity.brain_id

        if brain_id is not None:
            task.brain_id = brain_id
            task.save(update_fields=["brain"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0001_initial"),
        ("self_healing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="selfhealingtask",
            name="brain",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="self_healing_tasks",
                to="core.brain",
            ),
        ),
        migrations.RunPython(backfill_task_brains, migrations.RunPython.noop),
    ]
