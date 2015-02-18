from django.conf.urls import patterns, include, url
from django.contrib import admin
from gametheory.core.views import *

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'gametheory.views.home', name='home'),
    # url(r'^blog/', include('blog.urls')),
	url(r'^api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^register/(?P<player_name>.+)/(?P<player_uuid>.+)$', register),
    url(r'^get_player_stats_by_id/(?P<player_id>\d+)$', get_player_stats_by_id),
    url(r'^get_player_stats_by_uuid/(?P<player_uuid>.+)$', get_player_stats_by_uuid),
    url(r'^start_game/(?P<player_id>\d+)$', start_game),
    url(r'^player_cheat/(?P<player_id>\d+)/(?P<game_id>\d+)$', player_cheat),
    url(r'^player_split/(?P<player_id>\d+)/(?P<game_id>\d+)$', player_split),
    url(r'^player_timed_out/(?P<player_id>\d+)/(?P<game_id>\d+)$', player_timed_out),
    url(r'^leaders_overall$', leaders_overall),
    url(r'^leaders_country/(?P<player_id>\d+)$', leaders_country),
    url(r'^leaders_city/(?P<player_id>\d+)$', leaders_city),

    url(r'^rank_overall/(?P<player_id>\d+)$', rank_overall),
    url(r'^rank_country/(?P<player_id>\d+)$', rank_country),
    url(r'^rank_city/(?P<player_id>\d+)$', rank_city),
    
)
