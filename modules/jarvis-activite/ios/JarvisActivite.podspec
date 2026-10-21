Pod::Spec.new do |s|
  s.name           = 'JarvisActivite'
  s.version        = '0.1.0'
  s.summary        = 'Activite en direct Production de l appli Jarvis (preparee, non compilee).'
  s.author         = 'Flo'
  s.homepage       = 'https://example.invalid/jarvis'
  s.license        = { :type => 'Private' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'ActivityKit'
  s.source_files   = '**/*.swift'
end
