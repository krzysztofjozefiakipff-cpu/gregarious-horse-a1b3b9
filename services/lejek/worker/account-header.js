async function accountGroupBrand(db,group) {
  if (!group) return null;
  const saved=await db.prepare('SELECT logo FROM dealer_group_brand WHERE group_name=?').bind(group).first();
  const theme=await db.prepare('SELECT primary_color AS "primary",accent_color AS accent FROM dealer_group_theme WHERE group_name=?').bind(group).first()??null;
  if (saved) return {name:group,logo:saved.logo,theme};
  const logos=await list(db,`SELECT DISTINCT b.logo FROM dealer_brand b JOIN dealer_group_salons gs USING(salon)
    WHERE gs.group_name=? AND b.logo<>'' LIMIT 2`,group);
  return {name:group,logo:logos.length===1?logos[0].logo:'',theme};
}

async function loadAccountHeader(db,user,groupName) {
  const contact=user.id?await db.prepare('SELECT first_name FROM account_contact_details WHERE person=?').bind(user.id).first():null;
  const firstName=contact?.first_name?.trim()||user.name?.trim().split(/\s+/)[0]||'';
  const dealer=user.salon?await db.prepare('SELECT name,logo FROM dealer_brand WHERE salon=?').bind(user.salon).first():null;
  if (groupName===undefined) {
    groupName=user.role==='group'?user.group:user.activeDepartmentGroups?.[0]??(user.salon
      ?(await db.prepare('SELECT group_name FROM dealer_group_salons WHERE salon=?').bind(user.salon).first())?.group_name:null);
  }
  const groupBrand=await accountGroupBrand(db,groupName);
  const brand=user.role==='group'?(groupBrand?.logo?groupBrand:dealer):(dealer?.logo?dealer:groupBrand);
  return {firstName,brand,groupBrand,dealer};
}
