from django.conf.urls import patterns, include, url
from django.contrib import admin
from gametheory.core.views import *

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'gametheory.views.home', name='home'),
    # url(r'^blog/', include('blog.urls')),
	url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^get_player_stats/(?P<player_name>.+)$', get_player_stats),
    url(r'^start_game/(?P<player_id>\d+)$', start_game),
    url(r'^player_cheat/(?P<player_id>\d+)/(?P<game_id>\d+)$', player_cheat),
    url(r'^player_split/(?P<player_id>\d+)/(?P<game_id>\d+)$', player_split),
    #url(r'',  index),
)
