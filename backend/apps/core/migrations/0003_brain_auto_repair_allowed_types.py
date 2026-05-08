from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_brain_auto_repair_enabled_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='brain',
            name='auto_repair_allowed_types',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
