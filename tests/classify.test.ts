import { describe, expect, it } from 'vitest';
import { classifyNationality } from '../src/core/classify/nationality';
import { classifyAcademic } from '../src/core/classify/academic';
import { classifyFunding } from '../src/core/classify/funding';
import { matchFields } from '../src/core/classify/fields';
import { classifyOpportunityType, classifyStudyLevel } from '../src/core/classify/opportunityType';

describe('classifyNationality (Ghanaian eligibility)', () => {
  it('detects explicit Ghana eligibility', () => {
    const r = classifyNationality('Applicants must be citizens of Ghana or hold Ghanaian nationality.');
    expect(r.eligibility).toBe('ghana_eligible');
    expect(r.evidence).toContain('Ghana');
  });
  it('detects African eligibility', () => {
    expect(classifyNationality('Open to African nationals under the age of 35.').eligibility).toBe('africa_eligible');
  });
  it('detects international openness', () => {
    expect(classifyNationality('International students from all countries may apply.').eligibility).toBe('international');
  });
  it('detects developing-country eligibility as international', () => {
    expect(classifyNationality('Candidates from developing countries are eligible.').eligibility).toBe('international');
  });
  it('detects restrictions that exclude Ghana', () => {
    expect(classifyNationality('This award is restricted to citizens of the United States and Canada.').eligibility).toBe('restricted');
    expect(classifyNationality('You must be a UK citizen to apply.').eligibility).toBe('restricted');
    expect(classifyNationality('Domestic students only.').eligibility).toBe('restricted');
  });
  it('never claims eligibility without evidence', () => {
    expect(classifyNationality('A wonderful programme at a great university.').eligibility).toBe('unknown');
    expect(classifyNationality('').eligibility).toBe('unknown');
    expect(classifyNationality(null).eligibility).toBe('unknown');
  });
});

describe('classifyAcademic (52% CWA / 2:2)', () => {
  it('explicit 2:2 acceptance → clearly eligible, exact wording preserved', () => {
    const r = classifyAcademic('Applicants require at least a UK 2:2 honours degree or international equivalent.');
    expect(r.fit).toBe('clearly_eligible');
    expect(r.requirementText).toContain('2:2');
  });
  it('lower second-class wording → clearly eligible', () => {
    expect(classifyAcademic('A lower second-class honours degree is the minimum requirement.').fit).toBe('clearly_eligible');
  });
  it('first class / 70% → likely ineligible', () => {
    expect(classifyAcademic('Minimum 70% or First Class degree required.').fit).toBe('likely_ineligible');
    expect(classifyAcademic('Applicants must hold a first-class honours degree.').fit).toBe('likely_ineligible');
  });
  it('2:1 requirement → likely ineligible', () => {
    expect(classifyAcademic('You need an upper second-class (2:1) honours degree.').fit).toBe('likely_ineligible');
  });
  it('generic degree requirement → potentially eligible', () => {
    expect(classifyAcademic('Applicants must hold a bachelor\u2019s degree or equivalent in a relevant field.').fit).toBe('potentially_eligible');
  });
  it('foreign GPA scales are never converted — marked unclear', () => {
    const r = classifyAcademic('A GPA of at least 3.0 is required.');
    expect(r.fit).toBe('unclear');
    expect(r.interpretation).toContain('Do not assume');
  });
  it('no stated threshold → unknown, never invented', () => {
    const r = classifyAcademic('Join our exciting programme!');
    expect(r.fit).toBe('unknown');
    expect(r.requirementText).toBeNull();
  });
});

describe('classifyFunding', () => {
  it('fully funded + stipend', () => {
    expect(classifyFunding('This fully-funded scholarship includes a monthly living allowance.').type).toBe('fully_funded_stipend');
  });
  it('fully funded', () => {
    expect(classifyFunding('A fully funded opportunity for young leaders.').type).toBe('fully_funded');
  });
  it('tuition + stipend', () => {
    expect(classifyFunding('Covers tuition fees and a monthly stipend of $1,000.').type).toBe('tuition_stipend');
  });
  it('tuition waiver', () => {
    expect(classifyFunding('Successful applicants receive a tuition fee waiver.').type).toBe('tuition_waiver');
  });
  it('partial', () => {
    expect(classifyFunding('A partial scholarship covering 50% of tuition.').type).toBe('partial');
  });
  it('travel funding', () => {
    expect(classifyFunding('Travel grants available for conference attendance.').type).toBe('travel_funded');
  });
  it('unknown when not stated — never fabricated', () => {
    expect(classifyFunding('An exciting programme in Berlin.').type).toBe('unknown');
    expect(classifyFunding('').type).toBe('unknown');
  });
});

describe('matchFields', () => {
  it('matches user technical fields', () => {
    const r = matchFields('MSc in Computer Science with a focus on machine learning and cloud computing');
    expect(r.matchedFields).toContain('computer_science');
    expect(r.matchedFields).toContain('ml');
    expect(r.matchedFields).toContain('cloud');
    expect(r.environmental).toBe(false);
  });
  it('flags environmental relevance', () => {
    const r = matchFields('Fellowship on air quality and clean air technology');
    expect(r.environmental).toBe(true);
    expect(r.matchedFields).toContain('clean_air');
  });
  it('adjacent disciplines with tech component', () => {
    const r = matchFields('Electrical engineering programme with strong digital innovation and coding elements');
    expect(r.matchedFields.length === 0 && r.adjacentOnly).toBe(true);
  });
  it('detects open-to-all-fields wording', () => {
    expect(matchFields('Scholarships available for any field of study.').openToAllFields).toBe(true);
  });
});

describe('opportunity type & level', () => {
  it('classifies types', () => {
    expect(classifyOpportunityType('Summer School on AI in Lisbon')).toBe('summer_school');
    expect(classifyOpportunityType('DevOps Bootcamp scholarship')).toBe('bootcamp');
    expect(classifyOpportunityType('Clean air fellowship for cities')).toBe('fellowship');
    expect(classifyOpportunityType('Masters scholarship at Oxford')).toBe('masters_scholarship');
    expect(classifyOpportunityType('International Conference on Cloud Computing')).toBe('conference');
  });
  it('classifies study level', () => {
    expect(classifyStudyLevel('A master\u2019s degree scholarship')).toBe('masters');
    expect(classifyStudyLevel('Postgraduate diploma in IT')).toBe('postgraduate_diploma');
    expect(classifyStudyLevel('A hands-on bootcamp')).toBe('non_degree');
    expect(classifyStudyLevel('mystery text')).toBe('unknown');
  });
});
