from django.conf.urls import patterns, include, url
from django.contrib import admin
from gametheory.core.views import *

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'gametheory.views.home', name='home'),
    # url(r'^blog/', include('blog.urls')),
    url(r'^admin/', include(admin.site.urls)),

)
