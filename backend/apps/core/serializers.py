from rest_framework import serializers
from .models import Brain

class BrainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brain
        fields = ['id', 'name', 'description', 'created_at', 'updated_at']
