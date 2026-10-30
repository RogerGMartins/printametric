// Run through the browser tool against the focused local study.
async (page) => {
  await page.goto('http://127.0.0.1:5173/artifacts/impeccable-trial/index.html?direction=gridline&standalone=1');
  const f = page.frameLocator('iframe');
  await f.locator('html[data-theme]').waitFor();
  const results = [];
  const geometry = () => f.locator('.preview').evaluate(e => {
    const r = e.getBoundingClientRect(), h = document.querySelector('.header').getBoundingClientRect();
    const edge = document.elementFromPoint(innerWidth - 1, h.bottom + 30);
    return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, headerBottom:h.bottom, width:innerWidth, height:innerHeight, scrollWidth:document.documentElement.scrollWidth, rightEdgeIsPreview:e.contains(edge) };
  });
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({colorScheme:theme});
    for (const size of [{width:2560,height:1080},{width:1920,height:1080},{width:1440,height:900},{width:960,height:900},{width:768,height:1024},{width:320,height:800},{width:640,height:400}]) {
      await page.setViewportSize(size);
      const m = await geometry();
      if (Math.abs(m.left)>1 || Math.abs(m.right-m.width)>1 || Math.abs(m.bottom-m.height)>1 || Math.abs(m.top-m.headerBottom)>1 || m.scrollWidth>m.width || !m.rightEdgeIsPreview) throw Error('canvas '+JSON.stringify(m));
      const outer = await page.locator('iframe').evaluate(e => ({right:e.getBoundingClientRect().right, width:innerWidth}));
      if (Math.abs(outer.right - outer.width)>1) throw Error('wrapper leaves a right-side gap');
      if (await f.locator('.inspector summary').count()!==1) throw Error('expected one collapse control');
      for (const view of ['Print layout','Assembly','Design']) {
        await f.getByRole('link',{name:view,exact:true}).press('Enter');
        const s = f.getByText('Workspace settings',{exact:true});
        await s.press('Enter');
        if (!await s.evaluate(e=>e.parentElement.open)) throw Error('did not open settings');
        if (Math.abs((await geometry()).bottom-m.bottom)>1) throw Error('opening resized canvas');
        const bounds = await f.locator('.inspector').evaluate(e => {
          const r=e.getBoundingClientRect();
          const groups=[...e.querySelectorAll('.settings-group')].filter(g=>!g.hidden);
          const content=e.querySelector('.dock-content');
          return {left:r.left,right:r.right,width:innerWidth,groupRight:Math.max(...groups.map(g=>g.getBoundingClientRect().right)),padding:parseFloat(getComputedStyle(content).paddingRight),contentRight:content.getBoundingClientRect().left+content.clientWidth};
        });
        if (Math.abs(bounds.left)>1 || Math.abs(bounds.right-bounds.width)>1 || Math.abs(bounds.groupRight+bounds.padding-bounds.contentRight)>2) throw Error('empty settings column '+JSON.stringify(bounds));
        await s.press('Enter');
        if (await s.evaluate(e=>e.parentElement.open)) throw Error('did not close settings');
        if (await f.getByLabel('Show workspace tips').isVisible()) throw Error('collapsed content still visible');
      }
      await page.screenshot({path:'artifacts/impeccable-trial/gridline-final-'+theme+'-'+size.width+'.png'});
      results.push({theme,...size,canvas:m});
    }
  }
  await page.setViewportSize({width:1440,height:900});
  await f.getByText('Workspace settings',{exact:true}).press('Enter');
  await f.getByLabel('Grid',{exact:true}).check();
  await f.locator('.caption').waitFor({state:'visible'});
  await page.screenshot({path:'artifacts/impeccable-trial/gridline-final-open.png'});
  await f.getByRole('link',{name:'Print layout',exact:true}).press('Enter');
  if (!await f.getByLabel('Grid',{exact:true}).isChecked()) throw Error('settings lost');
  await f.getByRole('link',{name:'Design',exact:true}).press('Enter');
  await page.setViewportSize({width:320,height:800});
  await page.screenshot({path:'artifacts/impeccable-trial/gridline-final-phone-open.png'});
  await f.getByRole('button',{name:'Help',exact:true}).press('Enter');
  await f.locator('dialog:modal').waitFor();
  await page.keyboard.press('Escape');
  if (!await f.getByRole('button',{name:'Help',exact:true}).evaluate(e=>e===e.ownerDocument.activeElement)) throw Error('dialog restore');
  return results;
}
