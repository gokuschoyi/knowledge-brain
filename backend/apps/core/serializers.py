from rest_framework import serializers
from .models import Brain

class BrainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brain
        fields = [
            'id',
            'name',
            'description',
            'auto_repair_enabled',
            'auto_repair_safe_only',
            'auto_repair_frequency_minutes',
            'last_auto_repair_at',
            'created_at',
            'updated_at',
        ]
