Pod::Spec.new do |s|
  s.name           = 'JarvisIntents'
  s.version        = '0.1.0'
  s.summary        = 'Raccourcis Siri natifs et bouton Action de l appli Jarvis (prepares, non compiles).'
  s.author         = 'Flo'
  s.homepage       = 'https://example.invalid/jarvis'
  s.license        = { :type => 'Private' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files   = '**/*.swift'
end
