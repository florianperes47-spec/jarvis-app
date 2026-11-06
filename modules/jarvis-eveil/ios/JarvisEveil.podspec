Pod::Spec.new do |s|
  s.name           = 'JarvisEveil'
  s.version        = '0.1.0'
  s.summary        = 'Mot d eveil Jarvis sur l appareil (openWakeWord en ONNX), rien n est envoye avant le mot.'
  s.author         = 'Flo'
  s.homepage       = 'https://example.invalid/jarvis'
  s.license        = { :type => 'Private' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'onnxruntime-objc', '1.20.0'
  s.frameworks     = 'AVFoundation'
  s.source_files   = '*.swift'
  s.resource_bundles = { 'JarvisEveilModeles' => ['modeles/*.onnx'] }
end
