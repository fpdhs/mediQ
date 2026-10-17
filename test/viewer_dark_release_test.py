import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release',ROOT/'scripts/clinical-workspace-release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)

class ViewerPatchTests(unittest.TestCase):
    def old_html(self):
        return '<header>outside</header><section class="mq-screen" id="viewer-screen"><span class="studio-synthetic">합성 시연</span><div class="watermark-overlay" id="viewer-watermark">합성 시연 영상 · 임상 판단 금지</div><small>합성 데이터로 구성된 시연 환경입니다.</small><footer class="studio-footnote"><span>합성 시연 영상 · 임상 판단 금지</span><span>contrast</span></footer><span id="viewer-alert"></span></section><section>patient untouched</section>'
    def test_only_viewer_decorative_labels_change(self):
        html=release.dark_viewer_markup(self.old_html())
        self.assertTrue(html.startswith('<header>outside</header>'))
        self.assertTrue(html.endswith('<section>patient untouched</section>'))
        self.assertIn('id="viewer-watermark"></div>',html)
        self.assertIn('id="viewer-alert"',html)
        self.assertIn('<span>contrast</span>',html)
        self.assertNotIn('합성 시연',html)
    def test_unexpected_source_is_rejected(self):
        with self.assertRaisesRegex(AssertionError,'VIEWER_PATCH_ANCHOR_CHANGED'):
            release.dark_viewer_markup(self.old_html().replace('studio-synthetic','changed'))

if __name__=='__main__':unittest.main()
