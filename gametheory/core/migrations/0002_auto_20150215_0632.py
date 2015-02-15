# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import datetime


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='player',
            old_name='user_name',
            new_name='player_name',
        ),
        migrations.RenameField(
            model_name='queue',
            old_name='time',
            new_name='enter_time',
        ),
        migrations.RenameField(
            model_name='queue',
            old_name='user',
            new_name='player',
        ),
        migrations.AddField(
            model_name='game',
            name='finish_time',
            field=models.DateTimeField(auto_now=True, null=True),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='game',
            name='start_time',
            field=models.DateTimeField(default=datetime.date(2015, 2, 15), auto_now_add=True),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='queue',
            name='last_pool_time',
            field=models.DateTimeField(default=datetime.date(2015, 2, 15), auto_now=True, auto_now_add=True),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='game',
            name='player1',
            field=models.ForeignKey(related_name=b'gplayer1', to='core.Player', null=True),
        ),
        migrations.AlterField(
            model_name='game',
            name='player2',
            field=models.ForeignKey(related_name=b'gplayer2', to='core.Player', null=True),
        ),
    ]
